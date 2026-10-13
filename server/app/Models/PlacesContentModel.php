<?php

namespace App\Models;

use App\Entities\PlaceContentEntity;
use CodeIgniter\I18n\Time;

/**
 * Model for the `places_content` table.
 *
 * Holds the current localised title and text of each place: exactly one row
 * per (place_id, locale). Every saved version also goes to
 * `places_content_revisions` (PlacesContentRevisionsModel), so save texts
 * through saveContent(), not insert()/update().
 *
 * @package App\Models
 */
class PlacesContentModel extends ApplicationBaseModel
{
    /**
     * Edits by the same author of the same locale within this window update
     * their last revision instead of adding a new one.
     */
    public const REVISION_MERGE_WINDOW = DAY;

    protected $table            = 'places_content';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = PlaceContentEntity::class;
    protected $useSoftDeletes   = false;

    /** @var array<int, string> */
    protected $allowedFields = [
        'place_id',
        'user_id',
        'locale',
        'title',
        'content',
        'delta',
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
     * The current texts of a place in every locale it has one in.
     *
     * @return PlaceContentEntity[]
     */
    public function findTexts(string $placeId): array
    {
        return $this
            ->select('locale, title, content, updated_at')
            ->where('place_id', $placeId)
            ->orderBy('locale', 'ASC')
            ->findAll();
    }

    /**
     * Save the current text of a place in one locale and log it as a revision.
     *
     * $content->delta is the change in content length made by this edit; a revision
     * that absorbs several edits sums them up.
     *
     * @throws \ReflectionException
     */
    public function saveContent(PlaceContentEntity $content): bool
    {
        $this->db->transStart();

        $current = $this
            ->select('id')
            ->where(['place_id' => $content->place_id, 'locale' => $content->locale])
            ->first();

        $row = [
            'place_id' => $content->place_id,
            // The entity casts a missing author to '', which the users foreign key rejects
            'user_id'  => $content->user_id ?: null,
            'locale'   => $content->locale,
            'title'    => $content->title,
            'content'  => $content->content,
            'delta'    => self::clampDelta((int) $content->delta),
        ];

        if ($current) {
            $this->update($current->id, $row);
        } else {
            $this->insert($row);
        }

        $revisions = new PlacesContentRevisionsModel();
        $last      = $revisions->findLatest($content->place_id, $content->locale);

        if ($last && self::isSameEditSession($last->user_id, $last->created_at, $content->user_id, Time::now())) {
            $row['delta'] = self::clampDelta($row['delta'] + (int) $last->delta);
            $revisions->update($last->id, $row);
        } else {
            $revisions->insert($row);
        }

        $this->db->transComplete();

        return $this->db->transStatus();
    }

    /**
     * Fit a length change into the SMALLINT delta column.
     */
    private static function clampDelta(int $delta): int
    {
        return max(-32768, min(32767, $delta));
    }

    /**
     * Whether an edit continues the author's last revision rather than starting a new one:
     * the same signed-in author, within REVISION_MERGE_WINDOW of that revision's start.
     * Anonymous edits never merge.
     */
    public static function isSameEditSession(?string $lastAuthor, $lastCreatedAt, ?string $author, Time $now): bool
    {
        if (empty($author) || $lastAuthor !== $author || empty($lastCreatedAt)) {
            return false;
        }

        $started = $lastCreatedAt instanceof Time ? $lastCreatedAt : Time::parse((string) $lastCreatedAt);

        return $now->getTimestamp() - $started->getTimestamp() < self::REVISION_MERGE_WINDOW;
    }
}
