<?php

namespace App\Libraries;

use App\Libraries\Mail\EmailMessage;
use App\Libraries\Mail\MailingMail;
use App\Libraries\Mail\MailingContent;
use App\Libraries\Mail\MailQueue;
use App\Models\MailingsModel;
use CodeIgniter\HTTP\Files\UploadedFile;
use CodeIgniter\Validation\FormatRules;
use Config\Database;
use Generator;
use Throwable;

/**
 * The email mailings of the administrators (the table `mailings`): the draft with its texts and
 * picture, the audience, the queueing, the cancel. The letters are sent by the email queue
 * (App\Libraries\Mail\MailQueue), rendered from the mailing at send time (MailingMail).
 *
 * The audience: every user with a valid address, not bounced, not a service account, who has
 * not turned the `news` emails off: the rules of MailQueue::rejectReason(), applied at queue time.
 */
class MailingsLibrary
{
    public const IMAGE_MAX = 2 * 1024 * 1024;

    public const SUBJECT_MAX = 200;
    public const CONTENT_MAX = 20000;
    public const LABEL_MAX   = 60;
    public const URL_MAX     = 500;

    /** What the picture of a mailing may be: mail clients do not show WebP or SVG */
    private const IMAGE_TYPES = ['image/jpeg' => 'jpg', 'image/png' => 'png'];

    /** The reason of a letter dropped by a cancel */
    public const CANCELED_REASON = 'The mailing was canceled';

    private const BATCH = 500;

    private const FIELDS = ['subject', 'content', 'button_label', 'button_url'];

    private MailingsModel $model;
    private NotificationSettings $settings;

    public function __construct(?MailingsModel $model = null)
    {
        $this->model    = $model ?? new MailingsModel();
        $this->settings = new NotificationSettings();
    }

    // -------------------------------------------------------------------------
    // Reading
    // -------------------------------------------------------------------------

    /**
     * @return array<string, mixed>|null
     */
    public function find(string $id): ?array
    {
        return $this->model->find($id);
    }

    /**
     * @return array{items: array<int, array<string, mixed>>, count: int, stats: array<string, int>}
     */
    public function list(?string $status, int $page, int $limit): array
    {
        $this->model->completeFinished();

        $builder = Database::connect()->table('mailings')->where('deleted_at', null);

        if ($status !== null && in_array($status, MailingsModel::STATUSES, true)) {
            $builder->where('status', $status);
        }

        $count = (clone $builder)->countAllResults();
        $rows  = $builder->orderBy('created_at', 'DESC')->orderBy('id', 'DESC')->limit($limit, ($page - 1) * $limit)->get()->getResultArray();

        $stats = ['total' => 0] + array_fill_keys(MailingsModel::STATUSES, 0);

        foreach (Database::connect()->table('mailings')->select('status, COUNT(*) AS cnt', false)->where('deleted_at', null)->groupBy('status')->get()->getResultArray() as $row) {
            $stats[$row['status']] = (int) $row['cnt'];
            $stats['total']       += (int) $row['cnt'];
        }

        return ['items' => $this->present($rows), 'count' => $count, 'stats' => $stats];
    }

    /**
     * Mailings as the admin API sends them: the author and the delivery numbers added.
     *
     * @param array<int, array<string, mixed>> $rows
     *
     * @return array<int, array<string, mixed>>
     */
    public function present(array $rows): array
    {
        if (!$rows) {
            return [];
        }

        $db      = Database::connect();
        $authors = [];
        $ids     = array_column($rows, 'id');
        $userIds = array_values(array_unique(array_filter(array_column($rows, 'author_id'))));

        if ($userIds) {
            foreach ($db->table('users')->select('id, name, avatar')->whereIn('id', $userIds)->get()->getResultArray() as $user) {
                $author = ['id' => $user['id'], 'name' => $user['name']];

                if ($avatar = (new AvatarLibrary())->buildPath($user['id'], $user['avatar'])) {
                    $author['avatar'] = $avatar;
                }

                $authors[$user['id']] = $author;
            }
        }

        $delivery = [];

        foreach ($db->table('sending_mail')->select('mailing_id, status, COUNT(*) AS cnt', false)
            ->whereIn('mailing_id', $ids)->where('deleted_at', null)->groupBy(['mailing_id', 'status'])->get()->getResultArray() as $row) {
            $delivery[$row['mailing_id']][$row['status']] = (int) $row['cnt'];
        }

        return array_map(static function (array $row) use ($authors, $delivery): array {
            $count = $delivery[$row['id']] ?? [];

            return [
                'id'              => $row['id'],
                'status'          => $row['status'],
                'subject'         => $row['subject'],
                'content'         => $row['content'],
                'button_label'    => $row['button_label'],
                'button_url'      => $row['button_url'],
                'image'           => $row['image'],
                'author'          => $authors[$row['author_id']] ?? null,
                'created_at'      => $row['created_at'],
                'updated_at'      => $row['updated_at'],
                'sent_at'         => $row['sent_at'],
                'completed_at'    => $row['completed_at'],
                'recipients'      => (int) $row['recipients'],
                'delivery'        => [
                    'sent'     => ($count['completed'] ?? 0) + ($count['grouped'] ?? 0),
                    'pending'  => ($count['created'] ?? 0) + ($count['process'] ?? 0),
                    'failed'   => ($count['error'] ?? 0) + ($count['expired'] ?? 0),
                    'rejected' => $count['rejected'] ?? 0,
                ],
            ];
        }, $rows);
    }

    /**
     * One mailing as the admin API sends it; a mailing whose letters are all done is completed first.
     *
     * @return array<string, mixed>|null
     */
    public function show(string $id): ?array
    {
        $this->model->completeFinished();
        $row = $this->model->find($id);

        return $row ? $this->present([$row])[0] : null;
    }

    // -------------------------------------------------------------------------
    // Writing
    // -------------------------------------------------------------------------

    /**
     * The fields of a mailing from what the admin sent, and what is wrong with them. With $current
     * (a PATCH) a field not sent keeps its value.
     *
     * @param array<string, mixed>      $input
     * @param array<string, mixed>|null $current
     *
     * @return array{0: array<string, string|null>, 1: array<string, string>}
     */
    public function validate(array $input, ?array $current = null): array
    {
        $data   = [];
        $errors = [];

        foreach (self::FIELDS as $field) {
            if (!array_key_exists($field, $input)) {
                $data[$field] = $current[$field] ?? null;
                continue;
            }

            if ($input[$field] !== null && !is_string($input[$field])) {
                $errors[$field] = lang('Mailings.badField');
                continue;
            }

            $value = trim((string) $input[$field]);

            // One-line fields: a line break in the subject would end up in the letter's header
            if ($field === 'subject' || $field === 'button_label') {
                $value = (string) preg_replace('/\s+/u', ' ', $value);
            }

            $data[$field] = $value === '' ? null : $value;
        }

        $limits = [
            'subject'      => [self::SUBJECT_MAX, 'subjectLong'],
            'content'      => [self::CONTENT_MAX, 'contentLong'],
            'button_label' => [self::LABEL_MAX, 'labelLong'],
            'button_url'   => [self::URL_MAX, 'urlLong'],
        ];

        foreach ($limits as $field => [$max, $key]) {
            if (!isset($errors[$field]) && $data[$field] !== null && mb_strlen($data[$field]) > $max) {
                $errors[$field] = lang('Mailings.' . $key, [$max]);
            }
        }

        foreach (['subject' => 'subjectRequired', 'content' => 'contentRequired'] as $field => $key) {
            if (!isset($errors[$field]) && $data[$field] === null) {
                $errors[$field] = lang('Mailings.' . $key);
            }
        }

        if (!isset($errors['button_url']) && $data['button_url'] !== null) {
            if (!MailingContent::isLinkUrl($data['button_url'])) {
                $errors['button_url'] = lang('Mailings.urlInvalid');
            } elseif ($data['button_label'] === null && !isset($errors['button_label'])) {
                $errors['button_label'] = lang('Mailings.labelRequired');
            }
        }

        return [$data, $errors];
    }

    /**
     * @param array<string, mixed> $input
     *
     * @return array{0: array<string, mixed>|null, 1: array<string, string>}
     */
    public function create(array $input, string $authorId): array
    {
        [$data, $errors] = $this->validate($input);

        if ($errors) {
            return [null, $errors];
        }

        $this->model->insert($data + ['status' => 'draft', 'recipients' => 0, 'author_id' => $authorId]);

        return [$this->model->find($this->model->getLastGeneratedId()), []];
    }

    /**
     * @param array<string, mixed> $mailing The draft
     * @param array<string, mixed> $input
     *
     * @return array{0: array<string, mixed>|null, 1: array<string, string>}
     */
    public function update(array $mailing, array $input): array
    {
        [$data, $errors] = $this->validate($input, $mailing);

        if ($errors) {
            return [null, $errors];
        }

        $this->model->update($mailing['id'], $data);

        return [$this->model->find($mailing['id']), []];
    }

    /**
     * Deletes a draft with its picture.
     *
     * @param array<string, mixed> $mailing
     */
    public function delete(array $mailing): void
    {
        $this->model->delete($mailing['id']);

        foreach (glob(self::imageDir($mailing['id']) . '*') ?: [] as $file) {
            @unlink($file);
        }

        @rmdir(self::imageDir($mailing['id']));
    }

    // -------------------------------------------------------------------------
    // The picture
    // -------------------------------------------------------------------------

    /**
     * The extension of a valid picture of a mailing (`jpg`, `png`): JPEG or PNG up to 2 MB, by
     * the content, never by the name the client gave. Null for anything else.
     */
    public static function imageKind(UploadedFile $file): ?string
    {
        if (!$file->isValid() || $file->getSize() > self::IMAGE_MAX || $file->getSize() < 1) {
            return null;
        }

        $kind = self::IMAGE_TYPES[$file->getMimeType()] ?? null;

        // The content must be a picture of that type, not only look like one to finfo
        $info = @getimagesize($file->getRealPath() ?: $file->getPathname());

        if ($kind === null || !$info || ($info[2] ?? 0) !== ($kind === 'jpg' ? IMAGETYPE_JPEG : IMAGETYPE_PNG)) {
            return null;
        }

        return $kind;
    }

    /**
     * Stores the picture of a draft (a new one replaces the old).
     *
     * @param array<string, mixed> $mailing
     *
     * @return array<string, mixed>|null the mailing; null when the file could not be stored
     */
    public function storeImage(array $mailing, UploadedFile $file, string $kind): ?array
    {
        $dir = self::imageDir($mailing['id']);

        if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) {
            return null;
        }

        $name = bin2hex(random_bytes(8)) . '.' . $kind;

        if (!$file->move($dir, $name)) {
            return null;
        }

        $this->model->update($mailing['id'], ['image' => 'uploads/mailings/' . $mailing['id'] . '/' . $name]);
        self::removeImageFile($mailing['id'], $mailing['image']);

        return $this->model->find($mailing['id']);
    }

    /**
     * @param array<string, mixed> $mailing
     *
     * @return array<string, mixed>
     */
    public function removeImage(array $mailing): array
    {
        $this->model->update($mailing['id'], ['image' => null]);
        self::removeImageFile($mailing['id'], $mailing['image']);

        return $this->model->find($mailing['id']);
    }

    private static function imageDir(string $id): string
    {
        return FCPATH . 'uploads/mailings/' . $id . '/';
    }

    /** Deletes the picture file of the mailing; any other path is left alone */
    private static function removeImageFile(string $id, ?string $path): void
    {
        if (is_string($path) && preg_match('#^uploads/mailings/' . preg_quote($id, '#') . '/[A-Za-z0-9_-]+\.(jpg|png)$#', $path)) {
            @unlink(FCPATH . $path);
        }
    }

    // -------------------------------------------------------------------------
    // The audience and the sending
    // -------------------------------------------------------------------------

    /**
     * The users who get a mailing sent now, in batches.
     *
     * @return Generator<int, object[]> Rows with id, email
     */
    public function recipients(): Generator
    {
        $db   = Database::connect();
        $last = '';
        $mail = new FormatRules();

        do {
            $users = $db->table('users')
                ->select('id, email, settings')
                ->where('deleted_at', null)
                ->where('email IS NOT NULL', null, false)
                ->where('email !=', '')
                ->where('email_bounced_at', null)
                ->where('id >', $last)
                ->orderBy('id', 'ASC')
                ->limit(1000)
                ->get()->getResult();

            $batch = [];

            foreach ($users as $user) {
                $last = $user->id;

                if ($this->settings->isServiceEmail($user->email)
                    || !$this->settings->isEnabled($user->settings, 'email', 'news')
                    || !$mail->valid_email($user->email)) {
                    continue;
                }

                $batch[] = $user;
            }

            if ($batch) {
                yield $batch;
            }
        } while (count($users) === 1000);
    }

    /**
     * How many would get a letter if the mailing was sent now.
     *
     * @return array{total: int}
     */
    public function audience(): array
    {
        $total = 0;

        foreach ($this->recipients() as $batch) {
            $total += count($batch);
        }

        return ['total' => $total];
    }

    /**
     * Queues the letters of a draft and sets it to `sending`, in one transaction.
     *
     * @param array<string, mixed> $mailing
     *
     * @return array{0: array<string, mixed>|null, 1: string|null} the mailing, or the error:
     *         `conflict` (not a draft any more), `noRecipients`
     */
    public function send(array $mailing, ?MailQueue $queue = null): array
    {
        @set_time_limit(300);

        $db    = Database::connect();
        $queue = $queue ?? new MailQueue();
        $total = 0;

        $db->transBegin();

        try {
            // Only one request gets the draft: a second tap finds it `sending`
            $db->query("UPDATE `mailings` SET `status` = 'sending', `updated_at` = ? WHERE `id` = ? AND `status` = 'draft' AND `deleted_at` IS NULL", [date('Y-m-d H:i:s'), $mailing['id']]);

            if ($db->affectedRows() !== 1) {
                $db->transRollback();

                return [null, 'conflict'];
            }

            foreach ($this->recipients() as $batch) {
                foreach (array_chunk($batch, self::BATCH) as $chunk) {
                    $total += $queue->queueMailing($chunk, $mailing['id']);
                }
            }

            if ($total === 0) {
                $db->transRollback();

                return [null, 'noRecipients'];
            }

            $now = date('Y-m-d H:i:s');
            $db->table('mailings')->where('id', $mailing['id'])->update(['recipients' => $total, 'sent_at' => $now, 'updated_at' => $now]);
            $db->transCommit();
        } catch (Throwable $e) {
            $db->transRollback();

            throw $e;
        }

        return [$this->model->find($mailing['id']), null];
    }

    /**
     * Cancels a mailing in `sending` (or a draft): the letters still waiting are dropped, the ones
     * a run holds right now are dropped when it gets to them; the sent ones stay sent.
     *
     * @param array<string, mixed> $mailing
     *
     * @return array<string, mixed>
     */
    public function cancel(array $mailing): array
    {
        $now = date('Y-m-d H:i:s');
        $db  = Database::connect();

        $db->query("UPDATE `mailings` SET `status` = 'canceled', `updated_at` = ? WHERE `id` = ? AND `status` IN ('draft', 'sending')", [$now, $mailing['id']]);
        $db->query(
            "UPDATE `sending_mail` SET `status` = 'rejected', `error` = ?, `updated_at` = ? WHERE `mailing_id` = ? AND `status` = 'created'",
            [self::CANCELED_REASON, $now, $mailing['id']]
        );

        return $this->model->find($mailing['id']);
    }

    // -------------------------------------------------------------------------
    // The preview and the test letter
    // -------------------------------------------------------------------------

    /**
     * The letter as the preview shows it: the unsaved form, a harmless unsubscribe link.
     *
     * @param array<string, mixed> $form
     *
     * @return array{subject: string, html: string, text: string}
     */
    public static function preview(array $form): array
    {
        return MailingMail::render($form, '#');
    }

    /**
     * The test letter for the administrator: the real letter, its subject marked.
     *
     * @param array<string, mixed> $mailing
     */
    public static function testMessage(array $mailing, string $to, string $unsubscribeUrl): EmailMessage
    {
        $result = MailingMail::render($mailing, $unsubscribeUrl);

        return new EmailMessage($to, '[Тест] ' . $result['subject'], $result['html'], $result['text'], null, 'news');
    }
}
