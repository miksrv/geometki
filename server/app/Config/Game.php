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

    /** Metres of the reported accuracy of "I am here" added to the radius, at most */
    public int $accuracySlack = 150;

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
