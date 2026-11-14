<?php

namespace App\Models;

use App\Entities\VisitEntity;

/**
 * Model for the `users_visited_places` table: the log of check-ins ("I was here").
 *
 * One row per visit; a person can have many at one place, one a week (`REPEAT_DAYS`:
 * `Visits::create()` answers the visit of the week, a second tap in it cancels the visit on
 * the client). The unique key stays per day. No soft-deletion: a deleted visit is gone,
 * its photos stay (`photos.visit_id` → NULL) and its `visit` activity is soft-deleted by
 * the controller.
 *
 * @package App\Models
 */
class VisitsModel extends ApplicationBaseModel
{
    /** A new visit of the same person and place no sooner than this many days after the last one */
    public const REPEAT_DAYS = 7;

    /** `hidden`: a point of a riddle quest — nobody sees the visit until the walk is over */
    public const HIDDEN_RIDDLE = 1;

    /**
     * `hidden`: a visit made by a photo shot at the place, not by the person's own "I was here".
     * It carries the score of the season and nothing else: no `visit` event, not among the
     * visitors, the button is not pressed and asks no questions — until the person taps it
     * (VisitsLibrary::checkIn() then shows the visit).
     */
    public const HIDDEN_PHOTO = 2;

    protected $table            = 'users_visited_places';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = VisitEntity::class;
    protected $useSoftDeletes   = false;

    /** @var array<int, string> */
    protected $allowedFields = [
        'user_id',
        'place_id',
        'visited_at',
        'confirmed',
        'confirmed_at',
        'hidden',
    ];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';

    protected $validationRules    = [];
    protected $validationMessages = [];
    protected $skipValidation     = true;

    protected $allowCallbacks = true;
    protected $beforeInsert   = ['generateId'];

    /**
     * The user's visit of the place less than REPEAT_DAYS days from that day either way (a
     * back-dated resend of the offline queue meets a later visit too), the latest first.
     *
     * @param string $day `Y-m-d`
     */
    public function findWithinWindow(string $userId, string $placeId, string $day): ?VisitEntity
    {
        $from = date('Y-m-d', strtotime($day . ' -' . (self::REPEAT_DAYS - 1) . ' days'));
        $to   = date('Y-m-d', strtotime($day . ' +' . (self::REPEAT_DAYS - 1) . ' days'));

        return $this
            ->where(['user_id' => $userId, 'place_id' => $placeId])
            ->where('visited_at >=', $from . ' 00:00:00')
            ->where('visited_at <=', $to . ' 23:59:59')
            ->orderBy('visited_at', 'DESC')
            ->first();
    }
}
