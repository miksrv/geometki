<?php

namespace Config;

use CodeIgniter\Config\BaseConfig;

/**
 * The game (features/26-game-seasons-and-quests.md): the numbers of a season. All of them are
 * public: `GET /game` sends them and the "Game" page shows them as the table of points.
 *
 * The points of a confirmed place:
 *
 *     round(base × category × order) + photo bonus + white spot bonus
 *
 * Quests are not a part of a season: a walked quest gives experience (QuestsLibrary::bonusOf()), and
 * its points are ordinary confirmed places.
 *
 * `order` is the bonus to the first ones who confirm the place in the season.
 */
class Game extends BaseConfig
{
    /** The points of a confirmed place before the factors */
    public int $base = 10;

    /**
     * The factor of a category: how hard the place is to get to. A category not listed is 1.
     *
     * @var array<string, float>
     */
    public array $categories = [
        // In a town, by a road
        'memorial'     => 1.0,
        'artwork'      => 1.0,
        'museum'       => 1.0,
        'religious'    => 1.0,
        'architecture' => 1.0,
        'transport'    => 1.0,
        // Out of town, or not on every map
        'manor'        => 1.5,
        'castle'       => 1.5,
        'engineering'  => 1.5,
        'industrial'   => 1.5,
        'military'     => 1.5,
        'abandoned'    => 1.5,
        'archeology'   => 1.5,
        'disaster'     => 1.5,
        'mystic'       => 1.5,
        'viewpoint'    => 1.5,
        'camping'      => 1.5,
        'water'        => 1.5,
        'spring'       => 1.5,
        'landscape'    => 1.5,
        // A hike
        'mountain'     => 2.0,
        'cave'         => 2.0,
        'waterfall'    => 2.0,
    ];

    /**
     * The bonus to the first ones of the season at a place: the factor of the N-th person to
     * confirm it, by the upper bound of N. Later ones get 1.
     *
     * @var array<int, float> up to this place in the queue => factor
     */
    public array $order = [
        1 => 2.0,
        5 => 1.5,
    ];

    /** A confirmation by a photo: the photo is content, on top of the base points */
    public int $photoBonus = 5;

    /** A place the person made from a white spot in this season and confirmed by their own photo */
    public int $spotBonus = 10;

    /** Days after the end of a season its photos are still taken (uploaded at home) */
    public int $graceDays = 7;

    /** "Near the place": metres by category, $radius for the rest */
    public int $radius = 300;

    /**
     * @var array<string, int>
     */
    public array $radiuses = [
        'memorial'     => 200,
        'artwork'      => 200,
        'museum'       => 250,
        'religious'    => 250,
        'architecture' => 250,
        'transport'    => 300,
        'manor'        => 400,
        'castle'       => 400,
        'engineering'  => 500,
        'industrial'   => 500,
        'military'     => 500,
        'abandoned'    => 400,
        'archeology'   => 500,
        'disaster'     => 500,
        'mystic'       => 500,
        'viewpoint'    => 300,
        'camping'      => 500,
        'spring'       => 300,
        'waterfall'    => 500,
        'cave'         => 500,
        'water'        => 3000,
        'landscape'    => 3000,
        'mountain'     => 3000,
    ];

    /**
     * Metres of the reported accuracy of "I am here" added to the radius, at most (and never
     * more than half the radius of the place)
     */
    public int $accuracySlack = 150;

    /**
     * Places close together: the radius of a place is cut to this share of the way to the
     * nearest other place, so standing at one never confirms its neighbour…
     */
    public float $neighbourShare = 0.6;

    /** …but never below this, metres */
    public int $radiusFloor = 75;

    /**
     * A place with an outline from OSM (`places_outlines`, `php spark places:outlines`) is near
     * within this many metres of its outline too: a lake from its shore, a park at its gate
     */
    public int $outlineBuffer = 250;

    /** An OSM outline larger than this (the diagonal of its box, metres) is never taken */
    public int $outlineMaxSize = 300000;

    /** Metres around the point of a place an outline is looked for when the point is outside it */
    public int $outlineSearch = 300;

    /**
     * The OSM tags of an outline that fits a category (key => regex of the value); the categories
     * missing here are small, their radius is enough. An outline is taken only when its name
     * is like the title of the place too (PlaceOutlines::sameName())
     *
     * @var array<string, array<string, string>>
     */
    public array $outlineTags = [
        'water'      => ['natural' => 'water|bay|wetland', 'landuse' => 'reservoir|basin', 'water' => '.+'],
        'landscape'  => [
            'boundary' => 'protected_area|national_park',
            'leisure'  => 'nature_reserve|park',
            'natural'  => 'water|wood|scrub|heath|grassland|valley|cliff|ridge|wetland|sand|bare_rock|beach|gorge',
            'landuse'  => 'forest|meadow',
        ],
        'mountain'   => ['natural' => 'ridge|massif|mountain_range|hill|cliff|bare_rock|valley|gorge'],
        'manor'      => ['historic' => 'manor|estate|castle|building', 'building' => 'manor|palace|house', 'leisure' => 'park|garden'],
        'castle'     => ['historic' => 'castle|fort|citywalls|fortress|archaeological_site|manor', 'building' => 'castle|fortress'],
        'military'   => ['historic' => 'fort|castle|battlefield', 'military' => '.+', 'landuse' => 'military'],
        'archeology' => ['historic' => 'archaeological_site'],
        'industrial' => ['landuse' => 'industrial|quarry', 'man_made' => 'works|mineshaft', 'historic' => 'mine|industrial'],
        'religious'  => ['amenity' => 'monastery', 'landuse' => 'religious', 'historic' => 'monastery'],
        'camping'    => ['tourism' => 'camp_site', 'leisure' => 'park'],
        'abandoned'  => ['abandoned:landuse' => '.+', 'landuse' => 'brownfield|industrial|military', 'historic' => 'ruins|manor'],
    ];

    public function categoryFactor(?string $category): float
    {
        return (float) ($this->categories[$category ?? ''] ?? 1.0);
    }

    /** The factor of the N-th person (1 = the first) to confirm a place in the season */
    public function orderFactor(int $position): float
    {
        foreach ($this->order as $upTo => $factor) {
            if ($position <= $upTo) {
                return (float) $factor;
            }
        }

        return 1.0;
    }

    public function radiusOf(?string $category): int
    {
        return (int) ($this->radiuses[$category ?? ''] ?? $this->radius);
    }

    /** The points of a place before the bonuses */
    public function placePoints(?string $category, int $position): int
    {
        return (int) round($this->base * $this->categoryFactor($category) * $this->orderFactor($position));
    }
}
