<?php

namespace App\Models;

/**
 * Model for the `quests` table: a quest of the game, made by hand — an ordered list of the
 * site's places (`quests_points`) a person walks, confirming each one (`quests_walks`,
 * `quests_walks_points`). Soft-deleted; QuestsLibrary holds the rules.
 *
 * @package App\Models
 */
class QuestsModel extends ApplicationBaseModel
{
    public const MODE_OPEN    = 'open';
    public const MODE_STEPS   = 'steps';
    public const MODE_RIDDLES = 'riddles';
    /** A riddle quest whose riddle is the first photo of the place, not a text */
    public const MODE_PHOTOS = 'photos';

    public const MODES = [self::MODE_OPEN, self::MODE_STEPS, self::MODE_RIDDLES, self::MODE_PHOTOS];

    /**
     * The modes whose places are their answers: a place is not sent until it is found, the
     * quest is on no map of the lists (its search zone instead), its visits are hidden until
     * the walk is over and a far check-in tells no distance
     */
    public const SECRET_MODES = [self::MODE_RIDDLES, self::MODE_PHOTOS];

    public static function isSecret(string $mode): bool
    {
        return in_array($mode, self::SECRET_MODES, true);
    }

    public const STATUS_DRAFT     = 'draft';
    public const STATUS_PUBLISHED = 'published';

    protected $table            = 'quests';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = 'object';
    protected $useSoftDeletes   = true;

    /** @var array<int, string> */
    protected $allowedFields = [
        'mode',
        'status',
        'title_ru',
        'title_en',
        'description_ru',
        'description_en',
        'length_m',
        'points',
        'walked',
        'user_id',
    ];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';
    protected $deletedField  = 'deleted_at';

    protected $skipValidation = true;

    protected $allowCallbacks = true;
    protected $beforeInsert   = ['generateId'];
}
