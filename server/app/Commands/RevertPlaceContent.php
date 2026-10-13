<?php

/**
 * Run from CLI:
 *   php spark content:revert <placeId> --list
 *   php spark content:revert <placeId>
 *   php spark content:revert <placeId> --locale=en --revision=<revisionId>
 *
 * Rolls the text of a place in one locale back to an earlier revision from
 * places_content_revisions: the one before the latest by default, or the given one.
 * The rollback itself is saved as a new revision without an author, so it can be
 * reverted too. The place slug is left as it is.
 */

namespace App\Commands;

use App\Entities\PlaceContentEntity;
use App\Models\PlacesContentModel;
use App\Models\PlacesContentRevisionsModel;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

class RevertPlaceContent extends BaseCommand
{
    protected $group       = 'content';
    protected $name        = 'content:revert';
    protected $description = 'Roll a place text back to an earlier revision';
    protected $usage       = 'content:revert <placeId> [--locale=ru] [--revision=<id>] [--list]';
    protected $arguments   = [
        'placeId' => 'The place ID',
    ];
    protected $options     = [
        '--locale'   => 'The text locale, ru (default) or en',
        '--revision' => 'The revision ID to restore; the one before the latest by default',
        '--list'     => 'Only list the revisions, newest first',
    ];

    public function run(array $params)
    {
        $placeId = $params[0] ?? null;
        $locale  = CLI::getOption('locale') ?: 'ru';

        if (!$placeId || !in_array($locale, ['ru', 'en'], true)) {
            CLI::error('Usage: php spark ' . $this->usage);
            return EXIT_USER_INPUT;
        }

        $revisionsModel = new PlacesContentRevisionsModel();
        $revisions      = $revisionsModel
            ->where(['place_id' => $placeId, 'locale' => $locale])
            ->orderBy('created_at', 'DESC')
            ->orderBy('updated_at', 'DESC')
            ->findAll();

        if (empty($revisions)) {
            CLI::error("No revisions of place {$placeId} in locale {$locale}.");
            return EXIT_ERROR;
        }

        if (CLI::getOption('list') !== null) {
            CLI::table(array_map(static fn ($revision) => [
                $revision->id,
                (string) $revision->created_at,
                (string) $revision->updated_at,
                $revision->user_id ?? '—',
                $revision->delta,
                mb_strimwidth((string) $revision->title, 0, 60, '…'),
            ], $revisions), ['ID', 'Created', 'Updated', 'Author', 'Delta', 'Title']);

            return EXIT_SUCCESS;
        }

        $revisionId = CLI::getOption('revision');
        $target     = null;

        if ($revisionId) {
            foreach ($revisions as $revision) {
                if ($revision->id === $revisionId) {
                    $target = $revision;
                    break;
                }
            }
        } else {
            $target = $revisions[1] ?? null;
        }

        if (!$target) {
            CLI::error($revisionId
                ? "Revision {$revisionId} is not a revision of place {$placeId} in locale {$locale}."
                : 'There is no earlier revision to roll back to.');
            return EXIT_ERROR;
        }

        $contentModel = new PlacesContentModel();
        $current      = $contentModel->where(['place_id' => $placeId, 'locale' => $locale])->first();

        $content = new PlaceContentEntity();
        $content->place_id = $placeId;
        $content->locale   = $locale;
        $content->user_id  = null;
        $content->title    = $target->title;
        $content->content  = $target->content;
        $content->delta    = strlen((string) $target->content) - strlen((string) $current?->content);

        if (!$contentModel->saveContent($content)) {
            CLI::error('Could not save the text.');
            return EXIT_ERROR;
        }

        CLI::write("Place {$placeId} ({$locale}) is rolled back to revision {$target->id} of {$target->created_at}.", 'green');

        return EXIT_SUCCESS;
    }
}
