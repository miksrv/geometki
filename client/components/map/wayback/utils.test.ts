import { centerTile, pickRelease } from './utils'

const list = [
    { date: '2026-09-24', id: 5 },
    { date: '2021-02-24', id: 3 },
    { date: '2014-02-20', id: 1 }
]

describe('centerTile', () => {
    it('finds the tile under a point', () => {
        expect(centerTile(51.765, 55.1, 16)).toEqual({ x: 42798, y: 21716, z: 16 })
    })

    it('keeps the level within the range', () => {
        expect(centerTile(51.765, 55.1, 8).z).toBe(12)
        expect(centerTile(51.765, 55.1, 19).z).toBe(16)
    })
})

describe('pickRelease', () => {
    it('takes the newest by default', () => {
        expect(pickRelease(list)).toBe(list[0])
    })

    it('keeps the chosen release when the area has it', () => {
        expect(pickRelease(list, { date: '2021-02-24', id: 3 })).toBe(list[1])
    })

    it('takes the closest in time otherwise', () => {
        expect(pickRelease(list, { date: '2020-01-01', id: 9 })).toBe(list[1])
        expect(pickRelease(list, { date: '2015-06-01', id: 8 })).toBe(list[2])
    })

    it('has nothing to pick from an empty list', () => {
        expect(pickRelease([], list[0])).toBeUndefined()
    })
})
