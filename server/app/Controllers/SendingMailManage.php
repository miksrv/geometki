<?php

namespace App\Controllers;

use App\Libraries\AvatarLibrary;
use App\Libraries\SessionLibrary;
use App\Models\SendingMail;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;

class SendingMailManage extends ResourceController
{
    protected AvatarLibrary $avatarLibrary;

    private SessionLibrary $session;

    public function __construct()
    {
        $this->session = new SessionLibrary();
        $this->avatarLibrary = new AvatarLibrary();
    }

    /**
     * GET /sending-mail/manage
     * Admin only — paginated list with filtering, sorting, and stats.
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
     * GET /sending-mail/manage/:id
     * Admin only — full record with email body and error details.
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

    private function extractUser(object $row): ?object
    {
        if (empty($row->user_id)) {
            return null;
        }

        return (object) [
            'id'     => $row->user_id,
            'name'   => $row->user_name,
            'avatar' => $this->avatarLibrary->buildPath($row->user_id, $row->avatar, 'small')
        ];
    }

    private function extractActivity(object $row): ?object
    {
        if (empty($row->activity_id) || empty($row->activity_type)) {
            return null;
        }

        return (object) [
            'type' => $row->activity_type,
        ];
    }

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
