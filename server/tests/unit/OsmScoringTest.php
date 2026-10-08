<?php

use App\Libraries\OsmScoring;
use App\Libraries\OsmSourcesClient;
use CodeIgniter\Test\CIUnitTestCase;
use Config\OsmCandidates;

/**
 * Unit tests for App\Libraries\OsmScoring — how OSM objects become candidates for new places:
 * type filters, score points, tiers, title matching for duplicates and
 * Wikipedia articles, the nearest settlement. Pure PHP, no DB and no network.
 *
 * @internal
 */
final class OsmScoringTest extends CIUnitTestCase
{
    private OsmCandidates $config;
    private OsmScoring $scoring;

    protected function setUp(): void
    {
        parent::setUp();

        $this->config  = new OsmCandidates();
        $this->scoring = new OsmScoring($this->config);
    }

    private function codes(array $result): array
    {
        return array_column($result['breakdown'], 'code');
    }

    // =========================================================================
    // evaluate(): what is not a candidate at all
    // =========================================================================

    public function testUnknownTypeIsSkipped(): void
    {
        $this->assertSame('unknown type', $this->scoring->evaluate('node', ['amenity' => 'bench']));
    }

    public function testNamelessSpringIsSkipped(): void
    {
        $this->assertSame('no name: natural=spring', $this->scoring->evaluate('node', ['natural' => 'spring']));
    }

    public function testOrdinaryTreeIsSkipped(): void
    {
        $this->assertSame('not notable: natural=tree', $this->scoring->evaluate('node', ['natural' => 'tree']));
    }

    public function testMemorialPlaqueIsSkipped(): void
    {
        $result = $this->scoring->evaluate('node', ['historic' => 'memorial', 'memorial' => 'plaque', 'name' => 'Доска']);

        $this->assertSame('minor memorial: plaque', $result);
    }

    public function testPondIsNotALake(): void
    {
        $result = $this->scoring->evaluate('way', ['natural' => 'water', 'water' => 'pond', 'name' => 'Пруд']);

        $this->assertSame('not a lake', $result);
    }

    // =========================================================================
    // evaluate(): types and points
    // =========================================================================

    public function testNotableTreeIsACandidate(): void
    {
        $result = $this->scoring->evaluate('node', ['natural' => 'tree', 'denotation' => 'natural_monument', 'name' => 'Дуб']);

        $this->assertIsArray($result);
        $this->assertSame('natural=tree', $result['osmTag']);
        $this->assertContains('protected', $this->codes($result));
    }

    public function testSpecificTypeWinsOverTourismAttraction(): void
    {
        $result = $this->scoring->evaluate('node', ['tourism' => 'attraction', 'historic' => 'castle', 'name' => 'Замок']);

        $this->assertSame('historic=castle', $result['osmTag']);
        $this->assertSame('castle', $result['category']);
    }

    public function testNamelessCaveIsExplorableWithPenalty(): void
    {
        $result = $this->scoring->evaluate('node', ['natural' => 'cave_entrance']);

        $this->assertNull($result['name']);
        $this->assertTrue($result['explorable']);
        $this->assertSame(3 + $this->config->points['noName'], $result['score']);
    }

    public function testWikipediaTagGivesWikiPoints(): void
    {
        $result = $this->scoring->evaluate('node', ['historic' => 'monument', 'name' => 'Монумент', 'wikipedia' => 'ru:Монумент']);

        $this->assertSame(1 + $this->config->points['wiki'], $result['score']);
    }

    public function testNearbyArticleGivesPointsOnlyWithoutOsmLink(): void
    {
        $tags       = ['natural' => 'water', 'name' => 'Тузлучное озеро'];
        $enrichment = ['wikiSource' => 'nearby', 'wikiTitle' => 'Тузлучное', 'wikiDistance' => 11];

        $result = $this->scoring->evaluate('node', $tags, null, $enrichment);
        $nearby = array_values(array_filter($result['breakdown'], static fn ($item) => $item['code'] === 'nearbyWiki'));

        $this->assertCount(1, $nearby);
        $this->assertSame('Тузлучное', $nearby[0]['value']);
        $this->assertSame(11, $nearby[0]['distance']);
    }

    public function testSitelinksPointsGrowWithPopularity(): void
    {
        $tags = ['historic' => 'castle', 'name' => 'Замок'];

        $few  = $this->scoring->evaluate('node', $tags, null, ['sitelinks' => 1]);
        $many = $this->scoring->evaluate('node', $tags, null, ['sitelinks' => 30]);

        $this->assertSame(4 + 1, $few['score']);
        $this->assertSame(4 + 4, $many['score']);
    }

    public function testSaltyBigLakeGetsBonuses(): void
    {
        $result = $this->scoring->evaluate('relation', ['natural' => 'water', 'name' => 'Развал', 'salt' => 'yes'], 2500);

        $this->assertSame(['type', 'contour', 'salt', 'lakeSize'], $this->codes($result));
        $this->assertSame(1 + 1 + 2 + 2, $result['score']);
    }

    public function testPrivateAccessIsPenalized(): void
    {
        $result = $this->scoring->evaluate('node', ['historic' => 'manor', 'name' => 'Усадьба', 'access' => 'private']);

        $this->assertSame(3 + $this->config->points['private'], $result['score']);
    }

    // =========================================================================
    // evaluate(): objects from Wikidata and the Wikidata enrichment
    // =========================================================================

    public function testWikidataClassDefinesTheType(): void
    {
        $result = $this->scoring->evaluate('node', ['wd:class' => 'Q35509', 'name' => 'Пещера Шульган-Таш']);

        $this->assertSame('wd:class=Q35509', $result['osmTag']);
        $this->assertSame('cave', $result['category']);
        $this->assertTrue($result['explorable']);
        $this->assertSame('Пещера', $this->scoring->typeTitle('wd:class=Q35509', 'ru'));
        $this->assertSame('Cave', $this->scoring->typeTitle('wd:class=Q35509', 'en'));
    }

    public function testHeritageCodeIsAProtectedStatus(): void
    {
        $tags   = ['wd:class' => 'heritage:religious', 'name' => 'Церковь', 'wikipedia' => 'ru:Церковь'];
        $result = $this->scoring->evaluate('node', $tags, null, ['heritage' => '5610009000', 'sitelinks' => 2]);

        $this->assertSame('religious', $result['category']);
        $this->assertSame(['type', 'wiki', 'sitelinks', 'protected'], $this->codes($result));
    }

    public function testOsmHeritageTagIsAProtectedStatus(): void
    {
        $result = $this->scoring->evaluate('node', ['historic' => 'manor', 'name' => 'Усадьба', 'ref:okn' => '561410267480006']);

        $this->assertContains('protected', $this->codes($result));
    }

    public function testCommonsPhotoFromWikidataCounts(): void
    {
        $result = $this->scoring->evaluate('way', ['natural' => 'water', 'name' => 'Развал'], null, ['photo' => true]);

        $this->assertContains('photo', $this->codes($result));
    }

    public function testArticleOfGluedWikidataItemCountsLikeANearbyOne(): void
    {
        $enrichment = ['wikiSource' => 'wikidata', 'wikiTitle' => 'Развал (озеро)', 'wikiDistance' => 56];
        $result     = $this->scoring->evaluate('way', ['natural' => 'water', 'name' => 'Развал'], null, $enrichment);

        $this->assertContains('nearbyWiki', $this->codes($result));
    }

    // =========================================================================
    // tier()
    // =========================================================================

    public function testNamedHighScoreIsKnown(): void
    {
        $this->assertSame(OsmScoring::TIER_KNOWN, $this->scoring->tier($this->config->knownMinScore, 'Озеро', false));
    }

    public function testNamelessIsNeverKnown(): void
    {
        $this->assertSame(OsmScoring::TIER_EXPLORE, $this->scoring->tier(20, null, true));
        $this->assertSame(OsmScoring::TIER_OTHER, $this->scoring->tier(20, null, false));
    }

    public function testNegativeExplorableBecomesOther(): void
    {
        $this->assertSame(OsmScoring::TIER_OTHER, $this->scoring->tier(-1, 'Пещера', true));
    }

    // =========================================================================
    // titleSimilarity(), duplicateOf(), matchNearbyArticle()
    // =========================================================================

    public function testSimilarityIgnoresCityInBracketsAndStopWords(): void
    {
        $this->assertSame(100.0, $this->scoring->titleSimilarity('Петру I', 'Памятник Петру Первому (Оренбург)'));
    }

    public function testSingleSharedWordIsNotEnough(): void
    {
        $similarity = $this->scoring->titleSimilarity(
            'Оренбургский областной музей изобразительных искусств',
            'Памятник Оренбургскому водопроводу'
        );

        $this->assertLessThan(50, $similarity);
    }

    public function testDuplicateBySimilarTitleNearby(): void
    {
        $place = ['lat' => 51.7681, 'lon' => 55.0969, 'category' => 'monument', 'titles' => ['Памятник Валерию Чкалову']];

        $this->assertNotNull($this->scoring->duplicateOf('В.П. Чкалову', 'memorial', 51.7681, 55.0970, $place));
    }

    public function testNoDuplicateFarAway(): void
    {
        $place = ['lat' => 51.7681, 'lon' => 55.0969, 'category' => 'memorial', 'titles' => ['Памятник Чкалову']];

        $this->assertNull($this->scoring->duplicateOf('Чкалову', 'memorial', 51.80, 55.0969, $place));
    }

    public function testNearbyArticleAboutStreetIsSkipped(): void
    {
        $articles = [['pageid' => 1, 'title' => 'Улица Кирова (Самара)', 'lat' => 53.2, 'lon' => 50.1]];

        $this->assertNull($this->scoring->matchNearbyArticle('Кирова', 53.2, 50.1, $articles, []));
    }

    public function testNearbyArticleAboutSettlementIsSkippedForLakeNamedAfterIt(): void
    {
        $articles = [['pageid' => 1, 'title' => 'Курочкино (Оренбургская область)', 'lat' => 51.2, 'lon' => 55.0]];

        $this->assertNull($this->scoring->matchNearbyArticle('Курочкино', 51.2, 55.0, $articles, ['Курочкино']));
    }

    public function testNearbyLakeArticleIsFound(): void
    {
        $articles = [['pageid' => 7, 'title' => 'Развал (озеро)', 'lat' => 51.1492, 'lon' => 55.0011]];
        $article  = $this->scoring->matchNearbyArticle('Развал', 51.1490, 55.0016, $articles, ['Соль-Илецк']);

        $this->assertSame(7, $article['pageid']);
        $this->assertLessThan(100, $article['distance']);
    }

    // =========================================================================
    // nearestSettlement()
    // =========================================================================

    public function testBigCityCountsFromItsEdge(): void
    {
        $settlements = [
            ['name' => 'Самара', 'type' => 'city', 'population' => 1150000, 'lat' => 53.195, 'lon' => 50.101],
            ['name' => 'Усинский', 'type' => 'hamlet', 'population' => 0, 'lat' => 53.30, 'lon' => 50.25],
        ];

        $nearest = $this->scoring->nearestSettlement(53.2318, 50.1984, $settlements);

        $this->assertSame('Самара', $nearest['name']);
        $this->assertSame(0, $nearest['distance']);
    }

    // =========================================================================
    // Overpass query
    // =========================================================================

    public function testOverpassQueryAsksGatedTypesOnlyWhenNotable(): void
    {
        $query = (new OsmSourcesClient($this->config))->buildQuery([51.1, 54.9, 51.2, 55.0]);

        $this->assertStringContainsString('nwr["natural"~"^(tree)$"][~"^(wikidata|wikipedia|heritage|denotation|protect_class)$"~"."]', $query);
        $this->assertStringNotContainsString('|tree|', $query);
        $this->assertStringEndsWith('out tags bb;', $query);
    }

    // =========================================================================
    // placesGrid(), placesNear()
    // =========================================================================

    public function testGridFindsOnlyThePlacesThatMayBeDuplicates(): void
    {
        $near  = ['id' => 'near', 'lat' => 51.1501, 'lon' => 55.0002];
        $far   = ['id' => 'far', 'lat' => 51.2, 'lon' => 55.1];
        $grid  = $this->scoring->placesGrid([$near, $far], 51.2);
        $found = array_column($this->scoring->placesNear($grid, 51.15, 55.0), 'id');

        $this->assertSame(['near'], $found);
    }

    public function testGridCellsCoverTheDuplicateRadiusAcrossCellBorders(): void
    {
        // About 280 m to the east, across a cell border at a northern latitude
        $place = ['id' => 'east', 'lat' => 67.5, 'lon' => 33.006];
        $grid  = $this->scoring->placesGrid([$place], 67.5);

        $this->assertLessThan($this->config->duplicateRadius, OsmScoring::distance(67.5, 33.0, 67.5, 33.006));
        $this->assertSame(['east'], array_column($this->scoring->placesNear($grid, 67.5, 33.0), 'id'));
    }
}

