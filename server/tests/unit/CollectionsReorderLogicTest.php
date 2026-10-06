<?php

use CodeIgniter\Test\CIUnitTestCase;

/**
 * Unit tests for the reorder-validation logic used in
 * Collections::updatePlaces(): a requested "order" array is only applied
 * when it is exactly a permutation of the collection's current place IDs —
 * same set, no missing or extra IDs. Pure PHP, no DB.
 *
 * @internal
 */
final class CollectionsReorderLogicTest extends CIUnitTestCase
{
    /**
     * Mirrors the guard in Collections::updatePlaces():
     *   sort($current); sort($requested); if ($current !== $requested) fail;
     */
    private function isValidPermutation(array $current, array $requested): bool
    {
        sort($current);
        sort($requested);

        return $current === $requested;
    }

    public function testSameOrderIsValid(): void
    {
        $this->assertTrue($this->isValidPermutation(['a', 'b', 'c'], ['a', 'b', 'c']));
    }

    public function testReversedOrderIsValid(): void
    {
        $this->assertTrue($this->isValidPermutation(['a', 'b', 'c'], ['c', 'b', 'a']));
    }

    public function testShuffledOrderIsValid(): void
    {
        $this->assertTrue($this->isValidPermutation(['a', 'b', 'c', 'd'], ['c', 'a', 'd', 'b']));
    }

    public function testMissingIdIsInvalid(): void
    {
        $this->assertFalse($this->isValidPermutation(['a', 'b', 'c'], ['a', 'b']));
    }

    public function testExtraUnknownIdIsInvalid(): void
    {
        $this->assertFalse($this->isValidPermutation(['a', 'b', 'c'], ['a', 'b', 'c', 'z']));
    }

    public function testDuplicateIdInRequestIsInvalid(): void
    {
        // Same length and same "set" ignoring multiplicity would wrongly pass
        // a naive array_diff check; sort()+strict compare catches duplicates
        // because the sorted arrays differ in content at some index.
        $this->assertFalse($this->isValidPermutation(['a', 'b', 'c'], ['a', 'a', 'c']));
    }

    public function testEmptyCollectionWithEmptyOrderIsValid(): void
    {
        $this->assertTrue($this->isValidPermutation([], []));
    }

    /**
     * Mirrors Collections::updatePlaces() computing new 0-based positions
     * from an ordered placeId list.
     */
    private function positionsFromOrder(array $orderedPlaceIds): array
    {
        $positions = [];
        foreach ($orderedPlaceIds as $index => $placeId) {
            $positions[$placeId] = $index;
        }

        return $positions;
    }

    public function testPositionsAreZeroBasedAndSequential(): void
    {
        $positions = $this->positionsFromOrder(['p3', 'p1', 'p2']);

        $this->assertSame(['p3' => 0, 'p1' => 1, 'p2' => 2], $positions);
    }

    /**
     * Mirrors the note-length guard: note !== null && mb_strlen > max.
     */
    private function isNoteTooLong(?string $note, int $max): bool
    {
        return $note !== null && mb_strlen($note, 'UTF-8') > $max;
    }

    public function testNullNoteIsNeverTooLong(): void
    {
        $this->assertFalse($this->isNoteTooLong(null, 500));
    }

    public function testNoteAtLimitIsAllowed(): void
    {
        $this->assertFalse($this->isNoteTooLong(str_repeat('a', 500), 500));
    }

    public function testNoteOverLimitIsRejected(): void
    {
        $this->assertTrue($this->isNoteTooLong(str_repeat('a', 501), 500));
    }
}
