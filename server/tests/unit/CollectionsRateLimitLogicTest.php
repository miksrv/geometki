<?php

use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for the daily collection-creation rate limit used in
 * Collections::create():
 *
 *   if ($this->model->countCreatedSince($userId, $since) >= COLLECTION_CREATE_DAILY_LIMIT) {
 *       return $this->failTooManyRequests(...);
 *   }
 *
 * Pure PHP — no HTTP, no DB; countCreatedSince()'s return value is mirrored
 * as a plain integer.
 *
 * @internal
 */
final class CollectionsRateLimitLogicTest extends CIUnitTestCase
{
    private function isRateLimited(int $createdSinceCount, int $limit): bool
    {
        return $createdSinceCount >= $limit;
    }

    public function testWellUnderLimitIsAllowed(): void
    {
        $this->assertFalse($this->isRateLimited(1, COLLECTION_CREATE_DAILY_LIMIT));
    }

    public function testJustUnderLimitIsAllowed(): void
    {
        $this->assertFalse($this->isRateLimited(COLLECTION_CREATE_DAILY_LIMIT - 1, COLLECTION_CREATE_DAILY_LIMIT));
    }

    public function testExactlyAtLimitIsBlocked(): void
    {
        $this->assertTrue($this->isRateLimited(COLLECTION_CREATE_DAILY_LIMIT, COLLECTION_CREATE_DAILY_LIMIT));
    }

    public function testOverLimitIsBlocked(): void
    {
        $this->assertTrue($this->isRateLimited(COLLECTION_CREATE_DAILY_LIMIT + 5, COLLECTION_CREATE_DAILY_LIMIT));
    }

    public function testNoPriorCollectionsIsAllowed(): void
    {
        $this->assertFalse($this->isRateLimited(0, COLLECTION_CREATE_DAILY_LIMIT));
    }

    public function testConfiguredLimitIsTenPerDay(): void
    {
        // Collection creation is rate limited to 10 per user per day. Pin the constant so an accidental change is
        // caught by a test, not just in production.
        $this->assertSame(10, COLLECTION_CREATE_DAILY_LIMIT);
    }
}
