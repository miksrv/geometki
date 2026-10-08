<?php

namespace App\Libraries;

use Config\OsmCandidates;
use GuzzleHttp\Client;
use GuzzleHttp\Pool;
use GuzzleHttp\Psr7\Request;
use RuntimeException;
use Throwable;

/**
 * Network side of OSM candidates: Overpass for the objects, Wikipedia geosearch for the articles
 * missing in OSM, Wikidata for the popularity. Used only by the background collector,
 * never from a user request.
 *
 * @package App\Libraries
 */
class OsmSourcesClient
{
    private OsmCandidates $config;
    private Client $client;

    public function __construct(?OsmCandidates $config = null, ?Client $client = null)
    {
        $this->config = $config ?? config('OsmCandidates');
        $this->client = $client ?? new Client([
            'timeout' => 40,
            'headers' => ['User-Agent' => $this->config->userAgent],
        ]);
    }

    /**
     * Overpass QL query for the candidates of a tile and the settlements around it
     *
     * @param array{0: float, 1: float, 2: float, 3: float} $bounds south, west, north, east
     */
    public function buildQuery(array $bounds): string
    {
        $bbox = implode(',', $bounds);

        // A small declared timeout gets a place in the Overpass queue more easily
        $query = '[out:json][timeout:30];(';

        foreach ($this->config->types as $key => $values) {
            $open  = array_keys(array_filter($values, static fn ($type) => $type[4] !== 'gated'));
            $gated = array_keys(array_filter($values, static fn ($type) => $type[4] === 'gated'));

            if ($open) {
                $query .= 'nwr["' . $key . '"~"^(' . implode('|', $open) . ')$"](' . $bbox . ');';
            }

            // Trees, churches, towers: only the notable ones, otherwise there are thousands of them
            if ($gated) {
                $query .= 'nwr["' . $key . '"~"^(' . implode('|', $gated) . ')$"]'
                    . '[~"^(wikidata|wikipedia|heritage|denotation|protect_class)$"~"."](' . $bbox . ');';
            }
        }

        $query .= 'nwr["denotation"="natural_monument"](' . $bbox . ');';
        $query .= 'nwr["leisure"="nature_reserve"]["name"](' . $bbox . ');';

        // Named lakes only: there are thousands of nameless ponds
        $query .= 'nwr["natural"="water"]["name"]["water"~"^(lake|oxbow|lagoon)$"](' . $bbox . ');';
        $query .= 'nwr["natural"="water"]["name"][!"water"](' . $bbox . ');';

        // Settlements with a margin: a city node stands in its historic centre, often outside the tile
        [$south, $west, $north, $east] = $bounds;
        $wideBbox = implode(',', [$south - 0.2, $west - 0.3, $north + 0.2, $east + 0.3]);
        $query   .= 'node["place"~"^(city|town|village|hamlet)$"]["name"](' . $wideBbox . ');';

        // bb instead of center: the bounding box gives both the center and the size of the object
        return $query . ');out tags bb;';
    }

    /**
     * @return array Overpass elements
     * @throws RuntimeException when every server fails
     */
    public function fetchElements(array $bounds): array
    {
        $query  = $this->buildQuery($bounds);
        $errors = [];

        foreach ($this->config->overpassServers as $server) {
            try {
                $response = $this->client->post($server, ['form_params' => ['data' => $query]]);
                $data     = json_decode((string) $response->getBody(), true);

                // A timed out or out of memory query still answers 200, with partial elements and a remark
                $remark = (string) ($data['remark'] ?? '');

                if (preg_match('/runtime error|timed out|out of memory/i', $remark)) {
                    $errors[] = parse_url($server, PHP_URL_HOST) . ': ' . mb_substr($remark, 0, 200);
                } elseif (isset($data['elements'])) {
                    return $data['elements'];
                } else {
                    $errors[] = parse_url($server, PHP_URL_HOST) . ': empty response';
                }
            } catch (Throwable $e) {
                $errors[] = parse_url($server, PHP_URL_HOST) . ': ' . strtok($e->getMessage(), "\n");
            }
        }

        throw new RuntimeException('Overpass failed. ' . implode('; ', $errors));
    }

    /**
     * Russian Wikipedia articles with coordinates inside the bounds
     *
     * @return array<int, array> pageid => [pageid, title, lat, lon]
     */
    public function nearbyArticles(array $bounds): array
    {
        [$south, $west, $north, $east] = $bounds;

        try {
            $response = $this->client->get('https://ru.wikipedia.org/w/api.php', ['query' => [
                'action'      => 'query',
                'format'      => 'json',
                'list'        => 'geosearch',
                // Wikipedia refuses big boxes ("toobig"), a tile is small enough
                'gsbbox'      => "{$north}|{$west}|{$south}|{$east}",
                'gslimit'     => 500,
                'gsnamespace' => 0,
            ]]);
            $data = json_decode((string) $response->getBody(), true);
        } catch (Throwable $e) {
            throw new RuntimeException('Wikipedia geosearch failed: ' . strtok($e->getMessage(), "\n"));
        }

        $articles = [];

        foreach ($data['query']['geosearch'] ?? [] as $article) {
            $articles[$article['pageid']] = $article;
        }

        return $articles;
    }

    /**
     * Wikidata ids of Russian Wikipedia pages
     *
     * @param int[] $pageIds
     * @return array<int, string> pageid => Q-id
     */
    public function wikidataIds(array $pageIds): array
    {
        $ids = [];

        foreach (array_chunk(array_values(array_unique($pageIds)), 50) as $chunk) {
            try {
                $response = $this->client->get('https://ru.wikipedia.org/w/api.php', ['query' => [
                    'action'  => 'query',
                    'format'  => 'json',
                    'prop'    => 'pageprops',
                    'ppprop'  => 'wikibase_item',
                    'pageids' => implode('|', $chunk),
                ]]);
                $data = json_decode((string) $response->getBody(), true);

                foreach ($data['query']['pages'] ?? [] as $page) {
                    if (!empty($page['pageprops']['wikibase_item'])) {
                        $ids[$page['pageid']] = $page['pageprops']['wikibase_item'];
                    }
                }
            } catch (Throwable $e) {
                throw new RuntimeException('Wikipedia pageprops failed: ' . strtok($e->getMessage(), "\n"));
            }
        }

        return $ids;
    }

    /**
     * Popularity: the number of Wikipedia language versions of each Wikidata item
     *
     * @param string[] $qids
     * @return array<string, int> Q-id => number of Wikipedias
     */
    public function sitelinks(array $qids): array
    {
        $qids   = array_values(array_unique(array_filter($qids, static fn ($id) => preg_match('/^Q\d+$/', (string) $id))));
        $counts = [];

        foreach (array_chunk($qids, 50) as $chunk) {
            try {
                $response = $this->client->get('https://www.wikidata.org/w/api.php', ['query' => [
                    'action' => 'wbgetentities',
                    'ids'    => implode('|', $chunk),
                    'props'  => 'sitelinks',
                    'format' => 'json',
                ]]);
                $data = json_decode((string) $response->getBody(), true);

                foreach ($data['entities'] ?? [] as $id => $entity) {
                    // Only Wikipedias: enwiki, ruwiki… (not commonswiki, enwikivoyage etc.)
                    $counts[$id] = count(array_filter(
                        array_keys($entity['sitelinks'] ?? []),
                        static fn ($site) => preg_match('/^[a-z_]+wiki$/', $site) && !in_array($site, ['commonswiki', 'specieswiki'], true)
                    ));
                }
            } catch (Throwable $e) {
                throw new RuntimeException('Wikidata sitelinks failed: ' . strtok($e->getMessage(), "\n"));
            }
        }

        return $counts;
    }

    /**
     * SPARQL query for the Wikidata items of a tile: the configured classes (with their subclasses)
     * and anything with a Russian cultural heritage code
     */
    public function buildWikidataQuery(array $bounds): string
    {
        [$south, $west, $north, $east] = $bounds;

        $classes = implode(' ', array_map(
            static fn ($class) => "wd:{$class}",
            array_keys($this->config->wikidataTypes)
        ));

        // One row per item: the classes concatenated, Wikipedia articles counted (not Commons and other sites)
        return <<<SPARQL
            SELECT ?item (SAMPLE(?labelRu) AS ?ru) (SAMPLE(?labelEn) AS ?en) (SAMPLE(?coord) AS ?point)
                   (GROUP_CONCAT(DISTINCT ?class) AS ?classes) (SAMPLE(?image) AS ?photo) (SAMPLE(?heritage) AS ?code)
                   (COUNT(DISTINCT ?wiki) AS ?wikis) (SAMPLE(?article) AS ?ruArticle) WHERE {
              SERVICE wikibase:box {
                ?item wdt:P625 ?coord .
                bd:serviceParam wikibase:cornerSouthWest "Point({$west} {$south})"^^geo:wktLiteral .
                bd:serviceParam wikibase:cornerNorthEast "Point({$east} {$north})"^^geo:wktLiteral .
              }
              OPTIONAL { VALUES ?class { {$classes} } ?item wdt:P31/wdt:P279* ?class . }
              OPTIONAL { ?item wdt:P1483 ?heritage }
              FILTER(BOUND(?class) || BOUND(?heritage))
              OPTIONAL { ?item wdt:P18 ?image }
              OPTIONAL { ?wiki schema:about ?item ; schema:isPartOf/wikibase:wikiGroup "wikipedia" . }
              OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://ru.wikipedia.org/> . }
              OPTIONAL { ?item rdfs:label ?labelRu . FILTER(LANG(?labelRu) = "ru") }
              OPTIONAL { ?item rdfs:label ?labelEn . FILTER(LANG(?labelEn) = "en") }
            }
            GROUP BY ?item
            SPARQL;
    }

    /**
     * Wikidata items inside the bounds
     *
     * @return array<string, array> Q-id => [id, label, lat, lon, classes, image, heritage,
     *                              sitelinks (Wikipedia articles), article (Russian Wikipedia title)]
     * @throws RuntimeException when Wikidata fails
     */
    public function wikidataItems(array $bounds): array
    {
        try {
            $response = $this->client->post($this->config->wikidataSparql, [
                'form_params' => ['query' => $this->buildWikidataQuery($bounds)],
                'headers'     => ['Accept' => 'application/sparql-results+json'],
            ]);
            $data = json_decode((string) $response->getBody(), true);
        } catch (Throwable $e) {
            throw new RuntimeException('Wikidata failed: ' . strtok($e->getMessage(), "\n"));
        }

        $items = [];

        foreach ($data['results']['bindings'] ?? [] as $row) {
            if (!preg_match('/^Point\(([-\d.]+) ([-\d.]+)\)$/', $row['point']['value'] ?? '', $point)) {
                continue;
            }

            $id = basename($row['item']['value']);

            $items[$id] = [
                'id'        => $id,
                'label'     => $row['ru']['value'] ?? $row['en']['value'] ?? null,
                'lat'       => (float) $point[2],
                'lon'       => (float) $point[1],
                'classes'   => array_values(array_map('basename', array_filter(explode(' ', $row['classes']['value'] ?? '')))),
                // http://commons.wikimedia.org/wiki/Special:FilePath/Some%20file.jpg
                'image'     => isset($row['photo']) ? rawurldecode(basename($row['photo']['value'])) : null,
                'heritage'  => $row['code']['value'] ?? null,
                'sitelinks' => (int) ($row['wikis']['value'] ?? 0),
                'article'   => isset($row['ruArticle'])
                    ? str_replace('_', ' ', rawurldecode(basename($row['ruArticle']['value'])))
                    : null,
            ];
        }

        return $items;
    }

    /**
     * Photos of Wikimedia Commons files with their author and licence: a photo can be shown
     * (and later attached to a place) only with them
     *
     * @param string[] $files file names without the "File:" prefix
     * @return array<string, array> file name => [file, url, page, author, license, licenseUrl]
     */
    public function commonsPhotos(array $files): array
    {
        $files  = array_values(array_unique(array_map(static fn ($file) => str_replace('_', ' ', $file), $files)));
        $photos = [];
        $errors = [];

        // Up to 50 files per request, a few requests at a time: one by one they took seconds
        $requests = function () use ($files) {
            foreach (array_chunk($files, 50) as $chunk) {
                yield new Request('GET', 'https://commons.wikimedia.org/w/api.php?' . http_build_query([
                    'action'              => 'query',
                    'format'              => 'json',
                    'prop'                => 'imageinfo',
                    'iiprop'              => 'url|extmetadata',
                    'iiurlwidth'          => 640,
                    'iiextmetadatafilter' => 'Artist|LicenseShortName|LicenseUrl',
                    'titles'              => implode('|', array_map(static fn ($file) => "File:{$file}", $chunk)),
                ]));
            }
        };

        $pool = new Pool($this->client, $requests(), [
            'concurrency' => 4,
            'fulfilled'   => function ($response) use (&$photos) {
                $data = json_decode((string) $response->getBody(), true);

                foreach ($data['query']['pages'] ?? [] as $page) {
                    $photo = $this->commonsPhoto($page);

                    if ($photo) {
                        $photos[$photo['file']] = $photo;
                    }
                }
            },
            'rejected'    => static function ($reason) use (&$errors) {
                $errors[] = $reason instanceof Throwable ? strtok($reason->getMessage(), "\n") : 'unknown';
            },
        ]);

        $pool->promise()->wait();

        if ($errors) {
            throw new RuntimeException('Commons failed: ' . $errors[0]);
        }

        return $photos;
    }

    /**
     * A photo with its author and licence from a Commons imageinfo page
     */
    private function commonsPhoto(array $page): ?array
    {
        $info = $page['imageinfo'][0] ?? null;

        if (!$info || empty($info['thumburl'])) {
            return null;
        }

        $meta   = $info['extmetadata'] ?? [];
        $author = trim(html_entity_decode(strip_tags((string) ($meta['Artist']['value'] ?? ''))));

        return [
            'file'       => preg_replace('/^File:/', '', $page['title']),
            // Commons adds tracking parameters to the thumbnail links
            'url'        => preg_replace('/\?utm_[^#]*$/', '', $info['thumburl']),
            'page'       => $info['descriptionurl'] ?? null,
            'author'     => $author !== '' ? mb_substr($author, 0, 200) : null,
            'license'    => $meta['LicenseShortName']['value'] ?? null,
            'licenseUrl' => $meta['LicenseUrl']['value'] ?? null,
        ];
    }
}
