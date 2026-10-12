import { act, renderHook, waitFor } from '@testing-library/react'

import { useLocalChanges, WaybackTile } from './useLocalChanges'

const mockReleases = [
    { date: '2026-09-24', id: 3 },
    { date: '2020-10-14', id: 2 },
    { date: '2014-02-20', id: 1 }
]

// Tilemap requests wait here until the test answers them
const mockPending: Array<{ release: number; x: number; resolve: (value: unknown) => void }> = []
const mockUnsubscribe = jest.fn()

// A stable dispatch, like the store's
const mockDispatch = (action: unknown) => action

jest.mock('@/app/store', () => ({ useAppDispatch: () => mockDispatch }))

jest.mock('@/api/apiWayback', () => ({
    ...jest.requireActual('@/api/apiWayback'),
    APIWayback: {
        endpoints: {
            getTilemap: {
                initiate: ({ release, x }: { release: number; x: number }) => ({
                    unsubscribe: mockUnsubscribe,
                    unwrap: () => new Promise((resolve) => mockPending.push({ release, resolve, x }))
                })
            }
        },
        useGetReleasesQuery: () => ({ data: mockReleases, isError: false })
    }
}))

const answerNext = async (value: unknown) => {
    await waitFor(() => expect(mockPending.length).toBeGreaterThan(0))
    await act(async () => mockPending.shift()!.resolve(value))
}

const tileA: WaybackTile = { x: 1, y: 1, z: 16 }
const tileB: WaybackTile = { x: 2, y: 1, z: 16 }

describe('useLocalChanges', () => {
    beforeEach(() => {
        mockPending.length = 0
        mockUnsubscribe.mockClear()
    })

    it('shows the newest imagery after the first request and grows the list', async () => {
        const { result } = renderHook(() => useLocalChanges(tileA))

        await answerNext({ data: [1], select: [3] })
        expect(result.current.changes.map(({ id }) => id)).toEqual([3])
        expect(result.current.isFetching).toBe(true)

        await answerNext({ data: [1], select: [1] })
        expect(result.current.changes.map(({ id }) => id)).toEqual([3, 1])
        expect(result.current.isFetching).toBe(false)
        expect(mockUnsubscribe).toHaveBeenCalledTimes(2)
    })

    it('stops the walk of a tile the map has left', async () => {
        const { result, rerender } = renderHook(({ tile }) => useLocalChanges(tile), {
            initialProps: { tile: tileA }
        })

        await answerNext({ data: [1], select: [3] })
        rerender({ tile: tileB })

        // The answer for the old tile comes after the move: no more requests for it
        await answerNext({ data: [1], select: [2] })
        await waitFor(() => expect(mockPending).toHaveLength(1))
        expect(mockPending[0].x).toBe(tileB.x)

        // The list of the old tile stays until the new one has its first change
        expect(result.current.changes.map(({ id }) => id)).toEqual([3])
    })
})
