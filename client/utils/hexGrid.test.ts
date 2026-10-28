import { binByHex, hexCorners, hexKey, hexToPixel, pixelToHex } from './hexGrid'

const SIZE = 30

describe('hexGrid', () => {
    it('the centre of a cell maps back to the same cell', () => {
        for (const hex of [
            { q: 0, r: 0 },
            { q: 3, r: -2 },
            { q: -5, r: 7 },
            { q: 12, r: 12 }
        ]) {
            const { x, y } = hexToPixel(hex, SIZE)

            expect(pixelToHex(x, y, SIZE)).toStrictEqual(hex)
        }
    })

    it('every corner of a cell is closer to its centre than to a neighbour', () => {
        const centre = hexToPixel({ q: 2, r: 1 }, SIZE)

        // A point a little inside each corner stays in the cell
        hexCorners(centre.x, centre.y, SIZE).forEach(([cx, cy]) => {
            const x = centre.x + (cx - centre.x) * 0.95
            const y = centre.y + (cy - centre.y) * 0.95

            expect(pixelToHex(x, y, SIZE)).toStrictEqual({ q: 2, r: 1 })
        })
    })

    it('a pointy-top cell is sqrt(3) * size wide and 2 * size tall', () => {
        const corners = hexCorners(0, 0, SIZE)
        const xs = corners.map(([x]) => x)
        const ys = corners.map(([, y]) => y)

        expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(Math.sqrt(3) * SIZE, 6)
        expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(2 * SIZE, 6)
        // The first corner is the top one
        expect(corners[0][1]).toBeCloseTo(-SIZE, 6)
    })

    it('neighbouring cells share no pixel', () => {
        const seen = new Set<string>()

        for (let x = -100; x <= 100; x += 7) {
            for (let y = -100; y <= 100; y += 7) {
                seen.add(hexKey(pixelToHex(x, y, SIZE)))
            }
        }

        // 200 × 200 px at size 30 (cells ~52 × 60 px): roughly 16–25 cells
        expect(seen.size).toBeGreaterThan(12)
        expect(seen.size).toBeLessThan(30)
    })

    it('bins points, leaving out the ones with no pixel', () => {
        const points: Array<[number, number] | null> = [[1, 1], [2, 2], [500, 500], null]

        const bins = binByHex(points, (point) => point ?? undefined, SIZE)

        expect(bins).toHaveLength(2)
        expect(bins.find((bin) => bin.items.length === 2)?.items).toStrictEqual([
            [1, 1],
            [2, 2]
        ])
        // The bin's centre is the cell's centre, not the points' mean
        expect(bins[0].key).toBe(hexKey({ q: bins[0].q, r: bins[0].r }))
        expect(hexToPixel(bins[0], SIZE)).toStrictEqual({ x: bins[0].x, y: bins[0].y })
    })
})
