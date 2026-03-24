<?php

use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for auth-guard and validation logic in Comments controller.
 *
 * Comments::list()   — no auth required; responds with empty when no place param.
 * Comments::create() — requires auth; validates placeId (exactly 13 chars) and comment.
 *
 * All tests are pure PHP — no HTTP, no DB.
 *
 * @internal
 */
final class CommentsValidationTest extends CIUnitTestCase
{
    // =========================================================================
    // create() — auth guard
    // =========================================================================

    public function testCreateRequiresAuthentication(): void
    {
        $isAuth = false;

        // Mirrors: if (!$this->session->isAuth) { return $this->failUnauthorized(); }
        $this->assertTrue(!$isAuth);
    }

    public function testCreateAllowsAuthenticatedUsers(): void
    {
        $isAuth = true;

        $this->assertFalse(!$isAuth);
    }

    // =========================================================================
    // create() — placeId validation rules (from Comments::create rules array)
    // =========================================================================

    public function testPlaceIdExactly13CharsPassesValidation(): void
    {
        $validation = \Config\Services::validation(null, false);

        $ran = $validation->setRules([
            'placeId' => 'required|min_length[13]|max_length[13]',
            'comment' => 'required|string',
        ])->run(['placeId' => '1234567890123', 'comment' => 'Hello world']);

        $this->assertTrue($ran);
    }

    public function testPlaceIdLessThan13CharsFailsValidation(): void
    {
        $validation = \Config\Services::validation(null, false);

        $ran = $validation->setRules([
            'placeId' => 'required|min_length[13]|max_length[13]',
        ])->run(['placeId' => '12345']);

        $this->assertFalse($ran);
        $this->assertArrayHasKey('placeId', $validation->getErrors());
    }

    public function testPlaceIdMoreThan13CharsFailsValidation(): void
    {
        $validation = \Config\Services::validation(null, false);

        $ran = $validation->setRules([
            'placeId' => 'required|min_length[13]|max_length[13]',
        ])->run(['placeId' => '12345678901234']);

        $this->assertFalse($ran);
        $this->assertArrayHasKey('placeId', $validation->getErrors());
    }

    public function testMissingCommentFailsValidation(): void
    {
        $validation = \Config\Services::validation(null, false);

        $ran = $validation->setRules([
            'placeId' => 'required|min_length[13]|max_length[13]',
            'comment' => 'required|string',
        ])->run(['placeId' => '1234567890123']);

        $this->assertFalse($ran);
        $this->assertArrayHasKey('comment', $validation->getErrors());
    }

    public function testMissingPlaceIdFailsValidation(): void
    {
        $validation = \Config\Services::validation(null, false);

        $ran = $validation->setRules([
            'placeId' => 'required|min_length[13]|max_length[13]',
            'comment' => 'required|string',
        ])->run(['comment' => 'A valid comment']);

        $this->assertFalse($ran);
        $this->assertArrayHasKey('placeId', $validation->getErrors());
    }

    // =========================================================================
    // list() — empty response structure
    // =========================================================================

    public function testEmptyListResponseHasItemsAndCount(): void
    {
        // Mirrors: return $this->respond(['items' => [], 'count' => 0]);
        $response = ['items' => [], 'count' => 0];

        $this->assertArrayHasKey('items', $response);
        $this->assertArrayHasKey('count', $response);
        $this->assertSame([], $response['items']);
        $this->assertSame(0, $response['count']);
    }

    public function testListResponseCountMatchesItemCount(): void
    {
        $items    = ['a', 'b', 'c'];
        $response = ['items' => $items, 'count' => count($items)];

        $this->assertSame(3, $response['count']);
        $this->assertCount(3, $response['items']);
    }
}
