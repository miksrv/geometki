<?php namespace App\Libraries;

use App\Models\PlacesContentModel;
use CodeIgniter\Database\BaseConnection;
use Config\Services;

/**
 * Class for find actual translation for place
 *
 * Как работать:
 *
 * 1) Импортируем:
 *    $placeContent = new PlacesContent(350);
 *    350 - обрезает контент
 * 2) Находим перевод для объектов:
 *    A: Если используется поиск $placeContent->search('кратер');
 *    B: Если уже известен массив объектов: $placeContent->translate([{ID}, {ID}]);
 * 3) Для того, чтобы вернуть ID всех найденных объектов: $placeContent->placeIds;
 * 4) Перевод для каждого конкретного:
 *    А: Заголовок $placeContent->title({ID});
 *    B: Контент $placeContent->content({ID});
 */
class PlacesContent {

    /** The most places a 1–3 character term finds: its LIKE matches nearly every place */
    public const SHORT_TERM_LIMIT = 100;

    protected array $places = [];
    /** @var array<string, string[]> Locales each place has a text in */
    protected array $locales = [];

    /** Locale set by forLocale(); null means the request locale */
    protected ?string $forcedLocale = null;
    public array $placeIds = [];
    protected int $trim;

    private PlacesContentModel $model;

    /**
     * When calling the constructor, we set the parameters and start working with the model.
     * The library works in two modes:
     *  1) Search by keyword and return a list of location and content IDs for each
     *  2) Gets a list of place IDs, extracts content for them and returns it
     * @param int $trim
     */
    public function __construct(int $trim = 0) {
        $this->model = new PlacesContentModel();
        $this->trim  = $trim;

        $this->model->select(
            'id, place_id, title, user_id, locale, delta, created_at, updated_at,' .
            ($this->trim > 0 ? 'SUBSTRING(places_content.content, 1, ' . $this->trim . ') as content' : 'places_content.content')
        );
    }

    /**
     * Search places by term using FULLTEXT for longer terms, falling back to
     * LIKE for short terms where FULLTEXT minimum word length would miss results.
     *
     * Results are ranked by a combined score that weights title matches higher
     * than content matches and boosts popular places (views) and locale affinity.
     * A place matches by its text in any locale and is then shown in the request
     * locale, like everywhere else (translate()).
     *
     * @param string        $term
     * @param int|null      $limit      Only this many of the most relevant places; a short
     *                                  term finds SHORT_TERM_LIMIT at most
     * @param string[]      $categories Only places of these categories (before the limit)
     * @param bool          $withTexts  Load the texts of all found places; without them
     *                                  `placeIds` is set and translate() loads the texts needed
     * @return void
     */
    public function search(string $term, ?int $limit = null, array $categories = [], bool $withTexts = true): void {
        [$where, $params] = $this->matchCondition($term);

        if ($categories) {
            $where   .= ' AND p.category IN (' . implode(', ', array_fill(0, count($categories), '?')) . ')';
            $params   = [...$params, ...array_values($categories)];
        }

        if ($this->isShortTerm($term)) {
            // FULLTEXT requires at least 3-4 characters depending on ft_min_word_len;
            // LIKE for short terms to avoid missing results.
            $sql       = "SELECT pc.place_id FROM places_content pc
                JOIN places p ON p.id = pc.place_id AND p.deleted_at IS NULL
                WHERE {$where}
                GROUP BY pc.place_id
                ORDER BY MAX(pc.updated_at) DESC";
            $sqlParams = $params;
            $limit     = min($limit ?? self::SHORT_TERM_LIMIT, self::SHORT_TERM_LIMIT);
        } else {
            $booleanQuery = $this->booleanQuery($term);

            // One row per place: the best score among its locales
            $sql = "
                SELECT
                    pc.place_id,
                    MAX(
                        CASE WHEN pc.locale = ? THEN 2 ELSE 1 END
                        *
                        (
                            MATCH(pc.title)   AGAINST (? IN BOOLEAN MODE) * 10 +
                            MATCH(pc.content) AGAINST (? IN BOOLEAN MODE) * 1
                        )
                        *
                        (1 + LOG(1 + COALESCE(p.views, 0) / 1000))
                    ) AS final_score
                FROM places_content pc
                JOIN places p ON p.id = pc.place_id AND p.deleted_at IS NULL
                WHERE {$where}
                GROUP BY pc.place_id
                ORDER BY final_score DESC
            ";
            $sqlParams = [Services::request()->getLocale(), $booleanQuery, $booleanQuery, ...$params];
        }

        if ($limit !== null) {
            $sql .= ' LIMIT ' . max(0, $limit);
        }

        $ids = array_column(db_connect()->query($sql, $sqlParams)->getResult(), 'place_id');

        if ($withTexts) {
            $this->translate($ids);
            return;
        }

        $this->placeIds = array_values(array_unique($ids));
    }

    /**
     * How many places the term finds in each category: all of them, not only the loaded ones.
     * Places without a category are under the `''` key.
     *
     * @return array<string, int> Category => count, the fullest first
     */
    public function countByCategory(string $term): array {
        [$where, $params] = $this->matchCondition($term);

        $rows = db_connect()->query("
            SELECT p.category, COUNT(DISTINCT pc.place_id) AS found
            FROM places_content pc
            JOIN places p ON p.id = pc.place_id AND p.deleted_at IS NULL
            WHERE {$where}
            GROUP BY p.category
            ORDER BY found DESC
        ", $params)->getResult();

        $counts = [];

        foreach ($rows as $row) {
            $key          = (string) $row->category;
            $counts[$key] = ($counts[$key] ?? 0) + (int) $row->found;
        }

        return $counts;
    }

    private function isShortTerm(string $term): bool {
        return mb_strlen($term) <= 3;
    }

    /**
     * The WHERE of a search over `places_content pc` and its bound values.
     *
     * @return array{0: string, 1: array<int, string>}
     */
    private function matchCondition(string $term): array {
        if ($this->isShortTerm($term)) {
            $like = '%' . db_connect()->escapeLikeString($term) . '%';

            return ["(pc.title LIKE ? ESCAPE '!' OR pc.content LIKE ? ESCAPE '!')", [$like, $like]];
        }

        $booleanQuery = $this->booleanQuery($term);

        return [
            '(MATCH(pc.title) AGAINST (? IN BOOLEAN MODE) OR MATCH(pc.content) AGAINST (? IN BOOLEAN MODE))',
            [$booleanQuery, $booleanQuery],
        ];
    }

    /**
     * Split into words (≥3 chars), add wildcard to each; prepend exact-phrase
     * bonus so documents containing the full phrase score higher than those
     * with only scattered individual words.
     */
    private function booleanQuery(string $term): string {
        $words = array_values(array_filter(
            preg_split('/\s+/u', $term),
            static fn($w) => mb_strlen($w) >= 3
        ));

        if (empty($words)) {
            return $term . '*';
        }

        if (count($words) === 1) {
            return $words[0] . '*';
        }

        return '"' . $term . '" ' . implode('* ', $words) . '*';
    }

    /**
     * Show texts in this locale instead of the request one (emails built in CLI
     * for recipients with different locales).
     * @param string|null $locale
     * @return static
     */
    public function forLocale(?string $locale): static {
        $this->forcedLocale = $locale;

        return $this;
    }

    /**
     * Load the text of the given places: the request locale (or the forLocale() one), or the
     * other one when a place has no text in it. Keeps the order of $placeIds in $this->placeIds (search relevance).
     * @param array $placeIds
     * @return void
     */
    public function translate(array $placeIds): void {
        $this->placeIds = array_values(array_unique($placeIds));

        if (empty($this->placeIds)) {
            return ;
        }

        $data = $this->model
            ->whereIn('place_id', $this->placeIds)
            ->findAll();

        $locale   = $this->forcedLocale ?? Services::request()->getLocale();
        $byLocale = [];

        foreach ($data as $item) {
            $byLocale[$item->place_id][$item->locale] = $item;
        }

        foreach ($this->placeIds as $placeId) {
            $texts = $byLocale[$placeId] ?? [];

            if (!empty($texts)) {
                $this->places[$placeId]  = $texts[$locale] ?? reset($texts);
                $this->locales[$placeId] = array_keys($texts);
            }
        }
    }

    /**
     * Return title for place by ID
     * @param string $placeId
     * @return string
     */
    public function title(string $placeId): string {
        return $this->get($placeId, 'title');
    }

    /**
     * Return title for place by ID
     * @param string $placeId
     * @return string|null
     */
    public function content(string $placeId): string | null {
        return $this->get($placeId, 'content');
    }

    /**
     * The locale of the text title() and content() return: the request locale,
     * or the one the place falls back to when it has no text in it.
     * @param string $placeId
     * @return string|null
     */
    public function locale(string $placeId): string | null {
        return $this->places[$placeId]->locale ?? null;
    }

    /**
     * All locales the place has a text in.
     * @param string $placeId
     * @return string[]
     */
    public function locales(string $placeId): array {
        return $this->locales[$placeId] ?? [];
    }

    /**
     * @param string $id
     * @param string $field
     * @return string|null
     */
    public function get(string $id, string $field): string | null {
        if (isset($this->places[$id])) {
            return $this->places[$id]->{$field};
        }

        return '';
    }
}
