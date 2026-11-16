<?php

namespace App\Controllers;

use App\Controllers\Concerns\AdminOnly;
use App\Libraries\Mail\Mailer;
use App\Libraries\Mail\MailerException;
use App\Libraries\Mail\MailingMail;
use App\Libraries\Mail\MailUrls;
use App\Libraries\Mail\UnsubscribeToken;
use App\Libraries\MailingsLibrary;
use App\Libraries\SessionLibrary;
use App\Models\MailingsModel;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\RESTful\ResourceController;
use Config\Services;
use Throwable;

/**
 * The email mailings of the site (news, a new version, new awards): an administrator writes the
 * letter (in Russian), adds a picture, checks the preview, sends a test to
 * themselves and sends it to the users. The letters go through the email queue
 * (`notifications:send`). Admin only; never cached.
 *
 * @package App\Controllers
 */
class Mailings extends ResourceController
{
    use AdminOnly;

    private const LIMIT_DEFAULT = 20;
    private const LIMIT_MAX     = 100;

    /** Test letters an administrator may send in a minute */
    private const TESTS_PER_MINUTE = 5;

    protected SessionLibrary $session;

    private MailingsLibrary $mailings;

    public function __construct()
    {
        $this->session  = new SessionLibrary();
        $this->mailings = new MailingsLibrary();
    }

    /**
     * GET /mailings/manage?status=&page=&limit= → { items: MailingAdmin[], count, stats }
     */
    public function manage(): ResponseInterface
    {
        if ($denied = $this->adminOnly()) {
            return $denied;
        }

        $status = (string) $this->request->getGet('status');
        $page   = max(1, (int) ($this->request->getGet('page') ?? 1));
        $limit  = min(max(1, (int) ($this->request->getGet('limit') ?? self::LIMIT_DEFAULT)), self::LIMIT_MAX);

        return $this->respond($this->mailings->list($status !== '' ? $status : null, $page, $limit));
    }

    /**
     * GET /mailings/manage/:id → MailingAdmin
     *
     * @param string|null $id
     */
    public function manageShow($id = null): ResponseInterface
    {
        if ($denied = $this->adminOnly()) {
            return $denied;
        }

        $mailing = $id ? $this->mailings->show((string) $id) : null;

        return $mailing ? $this->respond($mailing) : $this->failNotFound(lang('Mailings.notFound'));
    }

    /**
     * How many users would get a letter if a mailing was sent now.
     *
     * GET /mailings/audience → { total }
     */
    public function audience(): ResponseInterface
    {
        if ($denied = $this->adminOnly()) {
            return $denied;
        }

        return $this->respond($this->mailings->audience());
    }

    /**
     * A new draft.
     *
     * POST /mailings (MailingInput) → 201 MailingAdmin
     */
    public function create(): ResponseInterface
    {
        if ($denied = $this->adminOnly()) {
            return $denied;
        }

        $input = $this->adminInput();

        if ($input === null) {
            return $this->failValidationErrors(lang('Mailings.badBody'));
        }

        [$mailing, $errors] = $this->mailings->create($input, (string) $this->session->user->id);

        if ($errors) {
            return $this->failValidationErrors($errors);
        }

        return $this->respondCreated($this->mailings->show($mailing['id']));
    }

    /**
     * Changes a draft; only what is sent.
     *
     * PATCH /mailings/:id (MailingInput) → MailingAdmin, 409 when not a draft
     *
     * @param string|null $id
     */
    public function update($id = null): ResponseInterface
    {
        if ($denied = $this->adminOnly()) {
            return $denied;
        }

        $mailing = $id ? $this->mailings->find((string) $id) : null;

        if (!$mailing) {
            return $this->failNotFound(lang('Mailings.notFound'));
        }

        if ($mailing['status'] !== 'draft') {
            return $this->failResourceExists(lang('Mailings.notDraft'));
        }

        $input = $this->adminInput();

        if ($input === null) {
            return $this->failValidationErrors(lang('Mailings.badBody'));
        }

        [$updated, $errors] = $this->mailings->update($mailing, $input);

        if ($errors) {
            return $this->failValidationErrors($errors);
        }

        return $this->respond($this->mailings->show($updated['id']));
    }

    /**
     * Deletes a draft with its picture.
     *
     * DELETE /mailings/:id → { id }, 409 when not a draft
     *
     * @param string|null $id
     */
    public function delete($id = null): ResponseInterface
    {
        if ($denied = $this->adminOnly()) {
            return $denied;
        }

        $mailing = $id ? $this->mailings->find((string) $id) : null;

        if (!$mailing) {
            return $this->failNotFound(lang('Mailings.notFound'));
        }

        if ($mailing['status'] !== 'draft') {
            return $this->failResourceExists(lang('Mailings.notDraft'));
        }

        $this->mailings->delete($mailing);

        return $this->respondDeleted(['id' => $mailing['id']]);
    }

    /**
     * The picture of a draft: JPEG or PNG up to 2 MB. A new one replaces the old.
     *
     * POST /mailings/:id/image (multipart, `image`) → MailingAdmin
     *
     * @param string|null $id
     */
    public function image($id = null): ResponseInterface
    {
        if ($denied = $this->adminOnly()) {
            return $denied;
        }

        $mailing = $id ? $this->mailings->find((string) $id) : null;

        if (!$mailing) {
            return $this->failNotFound(lang('Mailings.notFound'));
        }

        if ($mailing['status'] !== 'draft') {
            return $this->failResourceExists(lang('Mailings.notDraft'));
        }

        $file = $this->request->getFile('image');
        $kind = $file ? MailingsLibrary::imageKind($file) : null;

        if (!$file || $kind === null) {
            return $this->failValidationErrors(['image' => lang('Mailings.badImage')]);
        }

        $stored = $this->mailings->storeImage($mailing, $file, $kind);

        if (!$stored) {
            return $this->failServerError(lang('Mailings.imageError'));
        }

        return $this->respond($this->mailings->show($stored['id']));
    }

    /**
     * DELETE /mailings/:id/image → MailingAdmin, 409 when not a draft
     *
     * @param string|null $id
     */
    public function imageDelete($id = null): ResponseInterface
    {
        if ($denied = $this->adminOnly()) {
            return $denied;
        }

        $mailing = $id ? $this->mailings->find((string) $id) : null;

        if (!$mailing) {
            return $this->failNotFound(lang('Mailings.notFound'));
        }

        if ($mailing['status'] !== 'draft') {
            return $this->failResourceExists(lang('Mailings.notDraft'));
        }

        return $this->respond($this->mailings->show($this->mailings->removeImage($mailing)['id']));
    }

    /**
     * The letter as it will look: the unsaved form in the real template. The picture is the saved
     * one of the mailing `id`, when given.
     *
     * POST /mailings/preview (MailingInput & { id? }) → { html, subject }
     */
    public function preview(): ResponseInterface
    {
        if ($denied = $this->adminOnly()) {
            return $denied;
        }

        $input = $this->adminInput();

        if ($input === null) {
            return $this->failValidationErrors(lang('Mailings.badBody'));
        }

        $form = ['image' => null];

        foreach (['subject', 'content', 'button_label', 'button_url'] as $field) {
            $limit        = $field === 'content' ? MailingsLibrary::CONTENT_MAX : 1000;
            $form[$field] = is_string($input[$field] ?? null) ? mb_substr(trim($input[$field]), 0, $limit) : null;
        }

        $form['subject'] ??= '';
        $form['content'] ??= '';

        if (is_string($input['id'] ?? null) && ($saved = $this->mailings->find($input['id']))) {
            $form['image'] = $saved['image'];
        }

        $result = MailingsLibrary::preview($form);

        return $this->respond(['html' => $result['html'], 'subject' => $result['subject']]);
    }

    /**
     * A test letter to the administrator's own address, at once (not through the queue).
     *
     * POST /mailings/:id/test → { email }
     *
     * @param string|null $id
     */
    public function test($id = null): ResponseInterface
    {
        if ($denied = $this->adminOnly()) {
            return $denied;
        }

        $mailing = $id ? $this->mailings->find((string) $id) : null;

        if (!$mailing) {
            return $this->failNotFound(lang('Mailings.notFound'));
        }

        $email = (string) ($this->session->user->email ?? '');

        if ($email === '') {
            return $this->failValidationErrors(lang('Mailings.noEmail'));
        }

        if (!Services::throttler()->check('mailing_test_' . $this->session->user->id, self::TESTS_PER_MINUTE, MINUTE)) {
            return $this->failTooManyRequests(lang('Mailings.tooManyTests'));
        }

        try {
            $token = (new UnsubscribeToken())->create((string) $this->session->user->id, 'news');

            (new Mailer())->send(MailingsLibrary::testMessage($mailing, $email, MailUrls::unsubscribePage(MailingMail::LOCALE, $token)));
        } catch (MailerException $e) {
            log_message('error', '[Mailings] The test letter of {id} failed: {error}', ['id' => $mailing['id'], 'error' => $e->getMessage()]);

            return $this->failServerError(lang('Mailings.testFailed'));
        } catch (Throwable $e) {
            log_message('error', '{exception}', ['exception' => $e]);

            return $this->failServerError(lang('Mailings.testFailed'));
        }

        return $this->respond(['email' => $email]);
    }

    /**
     * Sends a draft: the letters of everyone in the audience are queued, `notifications:send` sends
     * them within the hosting limits.
     *
     * POST /mailings/:id/send → MailingAdmin (status `sending`), 409 when not a draft, 400 without recipients
     *
     * @param string|null $id
     */
    public function send($id = null): ResponseInterface
    {
        if ($denied = $this->adminOnly()) {
            return $denied;
        }

        $mailing = $id ? $this->mailings->find((string) $id) : null;

        if (!$mailing) {
            return $this->failNotFound(lang('Mailings.notFound'));
        }

        if ($mailing['status'] !== 'draft') {
            return $this->failResourceExists(lang('Mailings.notDraft'));
        }

        try {
            [$sent, $error] = $this->mailings->send($mailing);
        } catch (Throwable $e) {
            // Rolled back: the mailing is still a draft and nothing was queued
            log_message('error', '[Mailings] Sending {id} failed: {exception}', ['id' => $mailing['id'], 'exception' => $e]);

            return $this->failServerError(lang('Mailings.sendFailed'));
        }

        return match ($error) {
            null           => $this->respond($this->mailings->show($sent['id'])),
            'conflict'     => $this->failResourceExists(lang('Mailings.notDraft')),
            default        => $this->failValidationErrors(lang('Mailings.noRecipients')),
        };
    }

    /**
     * Cancels a draft or a mailing in `sending`: its letters still waiting are dropped, the sent
     * ones stay sent. Canceled already: nothing changes.
     *
     * POST /mailings/:id/cancel → MailingAdmin, 409 when completed
     *
     * @param string|null $id
     */
    public function cancel($id = null): ResponseInterface
    {
        if ($denied = $this->adminOnly()) {
            return $denied;
        }

        $mailing = $id ? $this->mailings->find((string) $id) : null;

        if (!$mailing) {
            return $this->failNotFound(lang('Mailings.notFound'));
        }

        // A mailing whose last letter went out is completed, not canceled
        if ($mailing['status'] === 'sending') {
            (new MailingsModel())->completeFinished();
            $mailing = $this->mailings->find($mailing['id']);
        }

        if ($mailing['status'] === 'completed') {
            return $this->failResourceExists(lang('Mailings.alreadyCompleted'));
        }

        if ($mailing['status'] !== 'canceled') {
            $mailing = $this->mailings->cancel($mailing);
        }

        return $this->respond($this->mailings->show($mailing['id']));
    }
}
