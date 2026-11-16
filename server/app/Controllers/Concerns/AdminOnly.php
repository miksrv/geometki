<?php

namespace App\Controllers\Concerns;

use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

/**
 * The guard and the body of an administrator's endpoint, shared by the admin controllers.
 * The controller has `$this->session` (SessionLibrary) and `$this->request`.
 */
trait AdminOnly
{
    /**
     * The answer for a non-admin: 401 for a guest, 403 for a member; null for an administrator.
     */
    protected function adminOnly(): ?ResponseInterface
    {
        $status = $this->session->adminStatus();

        return match ($status) {
            401     => $this->failUnauthorized(),
            403     => $this->failForbidden(),
            default => null,
        };
    }

    /**
     * What the administrator sent: the JSON object, or the form fields without a body. Null
     * when the body is not valid JSON or not an object / array.
     *
     * @return array<string, mixed>|null
     */
    protected function adminInput(bool $withForm = false): ?array
    {
        $body = trim((string) $this->request->getBody());

        if ($body === '') {
            return $withForm ? (array) $this->request->getPost() : [];
        }

        try {
            $data = json_decode($body, true, 32, JSON_THROW_ON_ERROR);
        } catch (Throwable) {
            // A form post has a body too
            return $withForm && !str_contains(strtolower($this->request->getHeaderLine('Content-Type')), 'json')
                ? (array) $this->request->getPost()
                : null;
        }

        return is_array($data) && ($data === [] || !array_is_list($data)) ? $data : null;
    }
}
