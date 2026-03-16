import { computePageNumbers, range } from './paginationUtils'

const LEFT = 'LEFT'
const RIGHT = 'RIGHT'

describe('range', () => {
    it('generates an inclusive range of numbers with default step 1', () => {
        expect(range(1, 5)).toStrictEqual([1, 2, 3, 4, 5])
    })

    it('returns a single-element array when from === to', () => {
        expect(range(3, 3)).toStrictEqual([3])
    })

    it('returns an empty array when from > to', () => {
        expect(range(5, 3)).toStrictEqual([])
    })

    it('respects a custom step', () => {
        expect(range(1, 10, 3)).toStrictEqual([1, 4, 7, 10])
    })
})

describe('computePageNumbers', () => {
    // neighbours = 2  →  totalNumbers = 7, totalBlocks = 9
    // dots appear when totalPages > totalBlocks (> 9)

    describe('no dots — total pages fits within the block', () => {
        it('returns all pages when totalPages <= totalBlocks', () => {
            // 9 pages, totalBlocks = 9 → falls into range(1, 9)
            expect(computePageNumbers(1, 9, 2)).toStrictEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
        })

        it('page 1 of 1 — single page', () => {
            expect(computePageNumbers(1, 1, 2)).toStrictEqual([1])
        })

        it('page 1 of 2', () => {
            expect(computePageNumbers(1, 2, 2)).toStrictEqual([1, 2])
        })
    })

    describe('right dots only — current page is near the start', () => {
        it('shows right dots when on first page of a large set', () => {
            // 20 pages, on page 1 → no left spill, right spill expected
            const pages = computePageNumbers(1, 20, 2)

            expect(pages[0]).toBe(1)
            expect(pages[pages.length - 1]).toBe(20)
            expect(pages).toContain(RIGHT)
            expect(pages).not.toContain(LEFT)
        })
    })

    describe('left dots only — current page is near the end', () => {
        it('shows left dots when on last page of a large set', () => {
            // 20 pages, on page 20 → left spill expected, no right spill
            const pages = computePageNumbers(20, 20, 2)

            expect(pages[0]).toBe(1)
            expect(pages[pages.length - 1]).toBe(20)
            expect(pages).toContain(LEFT)
            expect(pages).not.toContain(RIGHT)
        })
    })

    describe('both dots — current page is in the middle', () => {
        it('shows both left and right dots when in the middle of a large set', () => {
            // 20 pages, on page 10 → both spills expected
            const pages = computePageNumbers(10, 20, 2)

            expect(pages[0]).toBe(1)
            expect(pages[pages.length - 1]).toBe(20)
            expect(pages).toContain(LEFT)
            expect(pages).toContain(RIGHT)
        })
    })
})
