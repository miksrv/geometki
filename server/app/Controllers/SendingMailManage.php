<?php

namespace App\Controllers;

use App\Libraries\AvatarLibrary;
use App\Libraries\SessionLibrary;
use App\Models\SendingMail;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;

/**
 * SendingMailManage controller
 *
 * Admin-only interface for inspecting the outgoing mail queue (sending_mail table).
 * Provides a paginated, filterable list and a full detail view including the
 * email body and any delivery error.
 *
 * @package App\Controllers
 */
class SendingMailManage extends ResourceController
{
    protected AvatarLibrary $avatarLibrary;

    private SessionLibrary $session;

    public function __construct()
    {
        $this->session       = new SessionLibrary();
        $this->avatarLibrary = new AvatarLibrary();
    }

    /**
     * Return a paginated, filtered list of sent mail records with aggregate stats.
     *
     * GET /sending-mail/manage — admin only.
     * Accepted query params: status, email, date_from, date_to, sort, order, page, limit.
     *
     * @return ResponseInterface
     */
    public function index(): ResponseInterface
    {
        if (!$this->session->isAuth || $this->session->user?->role !== 'admin') {
            return $this->failForbidden();
        }

        $status   = $this->request->getGet('status');
        $email    = $this->request->getGet('email');
        $dateFrom = $this->request->getGet('date_from');
        $dateTo   = $this->request->getGet('date_to');
        $sort     = $this->request->getGet('sort');
        $order    = $this->request->getGet('order');
        $page     = (int) ($this->request->getGet('page') ?? 1);
        $limit    = (int) ($this->request->getGet('limit') ?? 20);

        $allowedSort  = ['created_at', 'updated_at', 'status', 'email'];
        $allowedOrder = ['asc', 'desc'];

        $sort  = in_array($sort, $allowedSort, true)  ? $sort  : 'created_at';
        $order = in_array($order, $allowedOrder, true) ? $order : 'desc';
        $limit = min(max(1, $limit), 100);
        $page  = max(1, $page);

        try {
            $stats = (new SendingMail())->getStats();

            $totalCount = (new SendingMail())
                ->applyFilters($status, $email, $dateFrom, $dateTo)
                ->countAllResults();

            $rows = (new SendingMail())
                ->applyListSelect()
                ->applyFilters($status, $email, $dateFrom, $dateTo)
                ->orderBy('sending_mail.' . $sort, $order)
                ->findAll($limit, ($page - 1) * $limit);

            $items = array_map(fn($row) => $this->formatListItem($row), $rows);

            return $this->respond([
                'items'        => $items,
                'count'        => $totalCount,
                'limit'        => $limit,
                'offset'       => ($page - 1) * $limit,
                'stats'        => $stats,
            ]);
        } catch (\Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
            return $this->failServerError(lang('SendingMailManage.fetchError'));
        }
    }

    /**
     * Return the full detail for a single sent mail record.
     *
     * GET /sending-mail/manage/:id — admin only.
     * Includes the rendered email body and any delivery error message.
     *
     * @param int|string|null $id Sending mail primary key.
     *
     * @return ResponseInterface
     */
    public function show($id = null): ResponseInterface
    {
        if (!$this->session->isAuth || $this->session->user?->role !== 'admin') {
            return $this->failForbidden();
        }

        if (!$id) {
            return $this->failNotFound(lang('SendingMailManage.notFound'));
        }

        try {
            $row = (new SendingMail())
                ->applyDetailSelect()
                ->where('sending_mail.id', $id)
                ->first();

            if (!$row) {
                return $this->failNotFound(lang('SendingMailManage.notFound'));
            }

            return $this->respond(['data' => $this->formatDetailItem($row)]);
        } catch (\Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);
            return $this->failServerError(lang('SendingMailManage.fetchError'));
        }
    }

    // -------------------------------------------------------------------------
    // Private helpers — presentation only, no SQL
    // -------------------------------------------------------------------------

    /**
     * Map a raw sending_mail row to the list response shape.
     *
     * @param object $row Raw DB row from the model.
     *
     * @return object Formatted list item.
     */
    private function formatListItem(object $row): object
    {
        return (object) [
            'id'       => $row->id,
            'status'   => $row->status,
            'email'    => $row->email,
            'subject'  => $row->subject,
            'created'  => $this->toDateTime($row->created_at),
            'updated'  => $this->toDateTime($row->updated_at),
            'user'     => $this->extractUser($row),
            'activity' => $this->extractActivity($row),
        ];
    }

    /**
     * Map a raw sending_mail row to the detail response shape (includes message and error).
     *
     * @param object $row Raw DB row from the model.
     *
     * @return object Formatted detail item.
     */
    private function formatDetailItem(object $row): object
    {
        return (object) [
            'id'      => $row->id,
            'status'  => $row->status,
            'email'   => $row->email,
            'subject' => $row->subject,
            'message' => $row->message,
            'error'   => $row->error,
            'created'    => $this->toDateTime($row->created_at),
            'updated'    => $this->toDateTime($row->updated_at),
            'user'       => $this->extractUser($row),
            'activity'   => $this->extractActivity($row),
        ];
    }

    /**
     * Extract the associated user data from a row, if present.
     *
     * @param object $row Raw DB row containing optional user_id, user_name, avatar fields.
     *
     * @return object|null User object or null when no user is linked.
     */
    private function extractUser(object $row): ?object
    {
        if (empty($row->user_id)) {
            return null;
        }

        return (object) [
            'id'     => $row->user_id,
            'name'   => $row->user_name,
            'avatar' => $this->avatarLibrary->buildPath($row->user_id, $row->user_avatar, 'small')
        ];
    }

    /**
     * Extract the linked activity data from a row, if present.
     *
     * @param object $row Raw DB row containing optional activity_id and activity_type.
     *
     * @return object|null Activity object or null when no activity is linked.
     */
    private function extractActivity(object $row): ?object
    {
        if (empty($row->activity_id) || empty($row->activity_type)) {
            return null;
        }

        return (object) [
            'type' => $row->activity_type,
        ];
    }

    /**
     * Convert a datetime string to the standard PHP DateTime object shape.
     *
     * @param string|null $value MySQL datetime string or null.
     *
     * @return object|null Object with date, timezone_type, and timezone fields; or null.
     */
    private function toDateTime(?string $value): ?object
    {
        if (!$value) {
            return null;
        }

        return (object) [
            'date'          => date('Y-m-d H:i:s.000000', strtotime($value)),
            'timezone_type' => 3,
            'timezone'      => 'UTC',
        ];
    }
}
