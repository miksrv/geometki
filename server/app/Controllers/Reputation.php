<?php

namespace App\Controllers;

use App\Libraries\PlaceFormatterLibrary;
use App\Libraries\ReputationLibrary;
use App\Models\UsersModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;

/**
 * The history of a user's reputation: the votes on the places they made and their share of
 * each (ReputationLibrary::history()). Public, like the reputation itself; who voted is not told.
 */
class Reputation extends ResourceController
{
    private const LIMIT = 20;

    /**
     * GET /users/:id/reputation?cursor= → { reputation, count, items: [{ id, stars, points, role,
     * created, place }], next }. `cursor` is the `next` of the previous page (`{created}_{id}` of
     * its last score); `next` is null after the last page.
     *
     * @param string $userId
     *
     * @return ResponseInterface
     */
    public function history(string $userId): ResponseInterface
    {
        $user = (new UsersModel())->select('id, reputation')->find($userId);

        if (!$user) {
            return $this->failNotFound();
        }

        $all   = (new ReputationLibrary())->history($user->id);
        $start = $this->startAfter($all, $this->request->getGet('cursor'));
        $page  = array_slice($all, $start, self::LIMIT);
        $places = (new PlaceFormatterLibrary())->listItems(
            array_values(array_unique(array_column($page, 'placeId'))),
            $this->request->getLocale()
        );

        $items = [];

        foreach ($page as $item) {
            $items[] = [
                'id'      => $item['id'],
                'stars'   => $item['stars'],
                'points'  => $item['points'],
                'role'    => $item['role'],
                'created' => (new \DateTime('@' . $item['created']))->setTimezone(new \DateTimeZone(date_default_timezone_get())),
                'place'   => $places[$item['placeId']] ?? null,
            ];
        }

        $last = $page[count($page) - 1] ?? null;

        return $this->respond([
            'reputation' => (int) $user->reputation,
            'count'      => count($all),
            'items'      => $items,
            // The last score shown, not an offset: a score that comes between two pages moves no item over
            'next'       => $last && $start + self::LIMIT < count($all) ? $last['created'] . '_' . $last['id'] : null,
        ]);
    }

    /**
     * Where a page starts: right after the score the cursor names (`{created}_{id}` of the last one
     * shown), in the history's order — newest first, then by id; the first page without a cursor.
     *
     * @param array<int, array{id: string, created: int}> $items
     */
    private function startAfter(array $items, mixed $cursor): int
    {
        if (!is_string($cursor) || !preg_match('/^(\d+)_([A-Za-z0-9]+)$/', $cursor, $match)) {
            return 0;
        }

        $after = [(int) $match[1], $match[2]];

        foreach ($items as $index => $item) {
            if ([$item['created'], $item['id']] < $after) {
                return $index;
            }
        }

        return count($items);
    }
}
