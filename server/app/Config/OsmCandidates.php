<?php

namespace Config;

use CodeIgniter\Config\BaseConfig;

/**
 * OSM candidates: interesting objects from OpenStreetMap that are not on Geometki yet.
 *
 * After changing the scoring rules run `php spark osm:rescore`: the scores are
 * recalculated from the stored OSM tags, without asking Overpass again.
 */
class OsmCandidates extends BaseConfig
{
    /** Tried in order until one answers */
    public array $overpassServers = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    ];

    public string $userAgent = 'Geometki/1.0 (https://geometki.com)';

    /** Tile size in degrees, the unit of collection */
    public float $tileSize = 0.1;

    /** Map requests for a bigger area (square degrees) are refused */
    public float $maxRequestArea = 1.0;

    /** Map requests covering more tiles are refused too: a thin tall strip has a small area but many tiles */
    public int $maxRequestTiles = 150;

    /** Days until a collected tile is collected again */
    public int $refreshDays = 60;

    /** A tile is refreshed only if somebody looked at it during these days */
    public int $activeDays = 90;

    /** A tile locked longer than this is taken as left by a dead collector */
    public int $staleLockMinutes = 15;

    /** After this many failures in a row the tile waits for the regular refresh */
    public int $maxAttempts = 5;

    /** Map requests per minute from one IP that may queue tiles; the rest only read the database */
    public int $queueRequestsPerMinute = 30;

    /** Collector: tiles per run and the pause between them, seconds */
    public int $tilesPerRun = 5;
    public int $pauseSeconds = 3;

    /** Score from which a named object is a "known" place */
    public int $knownMinScore = 4;

    /** A new place hides its candidate only when it is this close to the candidate, meters */
    public int $linkRadius = 1000;

    /** Duplicates: a similar title within this radius, or the same category within the smaller one, meters */
    public int $duplicateRadius = 300;
    public int $sameCategoryRadius = 50;

    /** A Wikipedia article with a similar title within this radius is taken as the object's article, meters */
    public int $wikiSearchRadius = 1000;

    /** Max candidates in one map response */
    public int $maxItemsPerResponse = 1000;

    /**
     * Whitelist: OSM key => [value => [category, title ru, title en, base score, mode]]
     *
     * mode: 'name' — a name is required; 'gated' — only with a Wikipedia link or a protected status
     * (asked so from Overpass, otherwise there are thousands of them); 'explore' — may have no name,
     * then it can only be "unexplored"; null — anything goes.
     *
     * The order matters: the first matching key defines the type, so the generic `tourism` goes late.
     */
    public array $types = [
        'natural' => [
            'peak'          => ['mountain', 'Вершина', 'Peak', 1, 'explore'],
            'volcano'       => ['mountain', 'Вулкан', 'Volcano', 3, null],
            'cave_entrance' => ['cave', 'Пещера', 'Cave', 3, null],
            'spring'        => ['spring', 'Родник', 'Spring', 1, 'name'],
            'hot_spring'    => ['spring', 'Горячий источник', 'Hot spring', 3, null],
            'geyser'        => ['nature', 'Гейзер', 'Geyser', 4, null],
            'cliff'         => ['mountain', 'Утёс', 'Cliff', 1, 'name'],
            'rock'          => ['mountain', 'Скала', 'Rock', 1, 'name'],
            'stone'         => ['nature', 'Камень', 'Stone', 0, 'name'],
            'arch'          => ['mountain', 'Скальная арка', 'Rock arch', 3, null],
            'gorge'         => ['nature', 'Ущелье', 'Gorge', 2, 'name'],
            'canyon'        => ['nature', 'Каньон', 'Canyon', 3, 'name'],
            'glacier'       => ['nature', 'Ледник', 'Glacier', 2, 'name'],
            'sinkhole'      => ['nature', 'Карстовая воронка', 'Sinkhole', 1, 'name'],
            'tree'          => ['nature', 'Дерево-памятник', 'Monumental tree', 1, 'gated'],
        ],
        'waterway' => [
            'waterfall' => ['waterfall', 'Водопад', 'Waterfall', 3, null],
            'rapids'    => ['water', 'Пороги', 'Rapids', 1, 'name'],
        ],
        'historic' => [
            'castle'              => ['castle', 'Замок', 'Castle', 4, null],
            'manor'               => ['manor', 'Усадьба', 'Manor', 3, null],
            'ruins'               => ['abandoned', 'Руины', 'Ruins', 2, null],
            'fort'                => ['military', 'Форт', 'Fort', 3, null],
            'monastery'           => ['religious', 'Монастырь', 'Monastery', 3, null],
            'archaeological_site' => ['archeology', 'Археология', 'Archaeological site', 2, null],
            'battlefield'         => ['battlefield', 'Место сражения', 'Battlefield', 2, null],
            'monument'            => ['monument', 'Монумент', 'Monument', 1, 'name'],
            'memorial'            => ['memorial', 'Мемориал', 'Memorial', 0, 'name'],
            'tank'                => ['transport', 'Танк', 'Tank', 2, null],
            'aircraft'            => ['transport', 'Самолёт', 'Aircraft', 2, null],
            'locomotive'          => ['transport', 'Паровоз', 'Locomotive', 2, null],
            'ship'                => ['transport', 'Корабль', 'Ship', 2, null],
            'wreck'               => ['abandoned', 'Затонувшее судно', 'Wreck', 2, null],
            'tower'               => ['construction', 'Башня', 'Tower', 1, 'name'],
            'city_gate'           => ['castle', 'Городские ворота', 'City gate', 2, null],
            'church'              => ['religious', 'Церковь', 'Church', 1, 'gated'],
            'building'            => ['manor', 'Историческое здание', 'Historic building', 0, 'gated'],
            'mine'                => ['mine', 'Шахта', 'Mine', 2, null],
            'wayside_shrine'      => ['religious', 'Часовня у дороги', 'Wayside shrine', -1, 'name'],
            'wayside_cross'       => ['religious', 'Поклонный крест', 'Wayside cross', -1, 'name'],
        ],
        'man_made' => [
            'lighthouse'  => ['construction', 'Маяк', 'Lighthouse', 3, null],
            'windmill'    => ['construction', 'Ветряная мельница', 'Windmill', 3, null],
            'watermill'   => ['construction', 'Водяная мельница', 'Watermill', 3, null],
            'observatory' => ['construction', 'Обсерватория', 'Observatory', 2, null],
            'adit'        => ['mine', 'Штольня', 'Adit', 1, 'explore'],
            'mineshaft'   => ['mine', 'Шахтный ствол', 'Mineshaft', 1, 'explore'],
            'water_tower' => ['construction', 'Водонапорная башня', 'Water tower', 0, 'gated'],
            'tower'       => ['construction', 'Башня', 'Tower', 0, 'gated'],
        ],
        'tourism' => [
            'viewpoint'  => ['nature', 'Смотровая площадка', 'Viewpoint', 1, null],
            'attraction' => ['monument', 'Достопримечательность', 'Attraction', 1, 'name'],
            'museum'     => ['museum', 'Музей', 'Museum', 2, 'name'],
            'artwork'    => ['monument', 'Арт-объект', 'Artwork', 0, 'name'],
        ],
        'amenity' => [
            'place_of_worship' => ['religious', 'Храм', 'Place of worship', 1, 'gated'],
        ],
    ];

    /**
     * Types outside the whitelist, matched by other tags. Asked from Overpass with their own filters
     * (see OsmOverpassClient): named lakes only, natural monuments and named nature reserves
     */
    public array $extraTypes = [
        'denotation=natural_monument' => ['nature', 'Памятник природы', 'Natural monument', 2, null],
        'leisure=nature_reserve'      => ['nature', 'ООПТ', 'Nature reserve', 0, 'name'],
        'natural=water'               => ['water', 'Озеро', 'Lake', 1, 'name'],
    ];

    /** Wikidata SPARQL endpoint: the second source, glued with OSM objects */
    public string $wikidataSparql = 'https://query.wikidata.org/sparql';

    /**
     * Wikidata classes (instance of, or a subclass of): Q-id => [category, title ru, title en, base score, mode].
     * The order matters: the first class the item belongs to defines its type.
     * Verified against Wikidata labels; the modes mean the same as in `types`.
     */
    public array $wikidataTypes = [
        'Q35509'     => ['cave', 'Пещера', 'Cave', 3, null],
        'Q34038'     => ['waterfall', 'Водопад', 'Waterfall', 3, null],
        'Q8072'      => ['mountain', 'Вулкан', 'Volcano', 3, null],
        'Q150784'    => ['nature', 'Каньон', 'Canyon', 3, null],
        'Q2042028'   => ['nature', 'Ущелье', 'Gorge', 2, null],
        'Q23790'     => ['nature', 'Памятник природы', 'Natural monument', 2, null],
        'Q2179685'   => ['nature', 'Памятник природы', 'Natural monument', 2, null],
        'Q23413'     => ['castle', 'Замок', 'Castle', 4, null],
        'Q44613'     => ['religious', 'Монастырь', 'Monastery', 3, null],
        'Q57821'     => ['military', 'Укрепление', 'Fortification', 3, null],
        'Q879050'    => ['manor', 'Усадьба', 'Manor', 3, null],
        'Q39715'     => ['construction', 'Маяк', 'Lighthouse', 3, null],
        'Q38720'     => ['construction', 'Ветряная мельница', 'Windmill', 3, null],
        'Q185187'    => ['construction', 'Водяная мельница', 'Watermill', 3, null],
        'Q109607'    => ['abandoned', 'Руины', 'Ruins', 2, null],
        'Q106765618' => ['abandoned', 'Заброшенное здание', 'Abandoned building', 2, null],
        'Q839954'    => ['archeology', 'Археология', 'Archaeological site', 2, null],
        'Q744099'    => ['archeology', 'Городище', 'Hillfort', 2, null],
        'Q5737'      => ['archeology', 'Курган', 'Kurgan', 2, null],
        'Q8502'      => ['mountain', 'Гора', 'Mountain', 2, null],
        'Q207326'    => ['mountain', 'Вершина', 'Summit', 1, 'explore'],
        'Q54050'     => ['mountain', 'Холм', 'Hill', 1, 'name'],
        'Q107679'    => ['mountain', 'Утёс', 'Cliff', 1, 'name'],
        'Q1404150'   => ['mountain', 'Скала', 'Rock', 1, 'name'],
        'Q188734'    => ['nature', 'Карстовая воронка', 'Sinkhole', 1, 'name'],
        'Q23397'     => ['water', 'Озеро', 'Lake', 1, 'name'],
        'Q124714'    => ['spring', 'Родник', 'Spring', 1, 'name'],
        'Q6017969'   => ['nature', 'Смотровая площадка', 'Viewpoint', 1, null],
        'Q33506'     => ['museum', 'Музей', 'Museum', 2, 'name'],
        'Q56190453'  => ['memorial', 'Мемориальный комплекс', 'Memorial complex', 1, 'name'],
        'Q5003624'   => ['memorial', 'Мемориал', 'Memorial', 0, 'name'],
        'Q4989906'   => ['monument', 'Памятник', 'Monument', 0, 'name'],
    ];

    /**
     * Wikidata items of none of the classes above, but with a Russian cultural heritage code (P1483).
     * There are hundreds of ordinary houses among them, so they need a Wikipedia article in any language.
     * The category is guessed by the title: [regex => pseudo class], the last one is the default.
     */
    public array $heritageClasses = [
        '/(церк|храм|собор|часовн|монастыр|мечет|синагог|костёл|костел|кирх|колокольн)/ui' => 'heritage:religious',
        '/(усадьб|особняк|дворец|имение)/ui'                                       => 'heritage:manor',
        '/.*/u'                                                                     => 'heritage',
    ];

    public array $heritageTypes = [
        'heritage:religious' => ['religious', 'Объект культурного наследия', 'Cultural heritage site', 0, null],
        'heritage:manor'     => ['manor', 'Объект культурного наследия', 'Cultural heritage site', 0, null],
        'heritage'           => ['monument', 'Объект культурного наследия', 'Cultural heritage site', 0, null],
    ];

    /** A Wikidata object is glued to an OSM one with a similar title within this radius, meters */
    public int $glueRadius = 300;

    /** Photos per candidate from Wikimedia Commons */
    public int $maxPhotos = 5;

    /** natural=water with these `water` values is not a lake */
    public array $notLakes = ['pond', 'reservoir', 'basin', 'river', 'canal', 'wastewater', 'stream_pool'];

    /** Minor memorials that are never candidates */
    public array $minorMemorials = ['plaque', 'stolperstein', 'blue_plaque', 'stone', 'cross', 'grave'];

    /**
     * Categories worth a visit even without any information in OSM: "unexplored" places
     * that a user can find, photograph and describe first
     */
    public array $exploreCategories = [
        'mountain', 'cave', 'waterfall', 'spring', 'nature', 'water', 'abandoned',
        'mine', 'archeology', 'military', 'battlefield', 'castle', 'manor', 'construction',
    ];

    /** Score points by signal */
    public array $points = [
        'wiki'        => 5,
        'nearbyWiki'  => 4,
        'protected'   => 3,
        'photo'       => 2,
        'description' => 1,
        'website'     => 1,
        'names'       => 1,
        'contour'     => 1,
        'salt'        => 2,
        'dimensions'  => 1,
        'noName'      => -2,
        'private'     => -3,
    ];

    /** Popularity by the number of Wikipedia language versions: [min versions => points], checked from the top */
    public array $sitelinksPoints = [25 => 4, 10 => 3, 3 => 2, 1 => 1];

    /** Lake size bonus: [min bounding box diagonal in meters => points], checked from the top */
    public array $lakeSizePoints = [2000 => 2, 500 => 1];

    /** Settlement radius by type when OSM has no population, meters */
    public array $settlementRadius = ['city' => 8000, 'town' => 2500, 'village' => 700, 'hamlet' => 200];

    /**
     * Words skipped when comparing titles: they say what the object is, not which one
     */
    public array $titleStopWords = [
        'памятник', 'музей', 'церковь', 'храм', 'часовня', 'монумент', 'мемориал', 'имени', 'им',
        'святой', 'святого', 'город', 'улица', 'на', 'в', 'и', 'с', 'у', 'по', 'the', 'of',
    ];

    /** Wikipedia articles about these are not about an object, even with a matching title */
    public string $notObjectArticles = '/(район|сельсовет|поселение|округ|область|улица|проспект|переулок|площадь|бульвар|набережная|шоссе|станция|вокзал|школа|гимназия|университет|институт|училище|больница|стадион|микрорайон|гостиниц|поликлиник|библиотек)/ui';

    /** An article about a settlement is still the object's one if its title says it is a natural object */
    public string $naturalArticles = '/(озеро|пещера|гора|водопад|родник|скала|урочище)/ui';
}
