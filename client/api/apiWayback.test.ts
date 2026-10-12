import { collectLocalChanges, parseWaybackConfig, WaybackRelease } from './apiWayback'

const releases: WaybackRelease[] = [
    { date: '2026-09-24', id: 5 },
    { date: '2025-01-10', id: 4 },
    { date: '2023-06-01', id: 3 },
    { date: '2020-03-15', id: 2 },
    { date: '2014-02-20', id: 1 }
]

describe('parseWaybackConfig', () => {
    it('takes the date from the title and sorts the releases newest first', () => {
        expect(
            parseWaybackConfig({
                '10': { itemTitle: 'World Imagery (Wayback 2014-02-20)' },
                '64776': { itemTitle: 'World Imagery (Wayback 2023-08-31)' },
                broken: { itemTitle: 'World Imagery (Wayback 2020-01-01)' },
                '7': { itemTitle: 'No date' }
            })
        ).toEqual([
            { date: '2023-08-31', id: 64776 },
            { date: '2014-02-20', id: 10 }
        ])
    })
})

describe('collectLocalChanges', () => {
    it('jumps from a release to the one its tile came from', async () => {
        // The tile changed in releases 5, 3 and 1: 4 repeats 3, 2 repeats 1
        const sources: Record<number, number> = { 1: 1, 2: 1, 3: 3, 4: 3, 5: 5 }
        const getTilemap = jest.fn(async (release: number) =>
            sources[release] === release ? { data: [1] } : { data: [1], select: [sources[release]] }
        )

        const changes = await collectLocalChanges(releases, getTilemap)

        expect(changes.map(({ id }) => id)).toEqual([5, 3, 1])
        expect(getTilemap.mock.calls.map(([release]) => release)).toEqual([5, 4, 2])
    })

    it('stops where the archive has no tile', async () => {
        const getTilemap = jest.fn(async (release: number) => ({ data: [release > 2 ? 1 : 0] }))

        expect((await collectLocalChanges(releases, getTilemap)).map(({ id }) => id)).toEqual([5, 4, 3])
    })
})
