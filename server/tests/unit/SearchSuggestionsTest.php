<?php

use App\Libraries\SearchSuggestions;
use CodeIgniter\Test\CIUnitTestCase;

/**
 * @internal
 */
final class SearchSuggestionsTest extends CIUnitTestCase
{
    public function testNamesStartingWithTheQueryGoFirstThenTheFullest(): void
    {
        $areas = [
            ['type' => 'region', 'title' => 'Новосибирская область', 'placesCount' => 900],
            ['type' => 'locality', 'title' => 'Сибай', 'placesCount' => 10],
            ['type' => 'district', 'title' => 'Сибирский район', 'placesCount' => 40],
        ];

        $ranked = SearchSuggestions::rankAreas($areas, 'сиб', 3);

        $this->assertSame(['Сибирский район', 'Сибай', 'Новосибирская область'], array_column($ranked, 'title'));
    }

    public function testTheNarrowestLevelWinsATieAndTheLimitCuts(): void
    {
        $areas = [
            ['type' => 'region', 'title' => 'Оренбург', 'placesCount' => 5],
            ['type' => 'locality', 'title' => 'Оренбург', 'placesCount' => 5],
            ['type' => 'district', 'title' => 'Оренбургский район', 'placesCount' => 1],
        ];

        $ranked = SearchSuggestions::rankAreas($areas, 'Оренбург', 2);

        $this->assertSame(['locality', 'region'], array_column($ranked, 'type'));
    }

    public function testTheCaptionSkipsEmptyRepeatedPartsAndTheTitle(): void
    {
        $this->assertSame(
            'Оренбургская область, Россия',
            SearchSuggestions::caption('Оренбург', ['Оренбург', '', null, 'Оренбургская область', 'Россия', 'россия'])
        );
        $this->assertNull(SearchSuggestions::caption('Москва', ['Москва', null]));
    }
}
