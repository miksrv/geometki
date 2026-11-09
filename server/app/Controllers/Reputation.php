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
     * created, place }], next }. `cursor` is the offset of the page (the `next` of the previous
     * one); `next` is null after the last page.
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

        $offset = max(0, (int) ($this->request->getGet('cursor') ?? 0));
        $all    = (new ReputationLibrary())->history($user->id);
        $page   = array_slice($all, $offset, self::LIMIT);
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

        $next = $offset + self::LIMIT;

        return $this->respond([
            'reputation' => (int) $user->reputation,
            'count'      => count($all),
            'items'      => $items,
            'next'       => $next < count($all) ? (string) $next : null,
        ]);
    }
}
