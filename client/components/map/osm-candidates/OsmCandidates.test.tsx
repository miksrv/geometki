import React from 'react'

import { act, render, screen } from '@testing-library/react'

import { API, ApiType } from '@/api'

import { OsmCandidates } from './OsmCandidates'

// Every `position` and `icon` object gets a number: the same object keeps its number across renders
const objectIds = new WeakMap<object, number>()
const objectId = (value: object): number => {
    if (!objectIds.has(value)) {
        objectIds.set(value, objectIds.get(value) ?? Math.random())
    }

    return objectIds.get(value)!
}

jest.mock('react-leaflet', () => ({
    Marker: ({
        children,
        position,
        icon
    }: {
        children?: React.ReactNode
        position: [number, number]
        icon: object
    }) => (
        <div
            data-testid={'white-spot-marker'}
            data-center={objectId(position)}
            data-options={objectId(icon)}
        >
            {children}
        </div>
    ),
    Popup: () => null,
    Tooltip: ({ children }: { children?: React.ReactNode }) => (
        <span data-testid={'candidate-tooltip'}>{children}</span>
    ),
    useMapEvents: jest.fn().mockImplementation(() => ({
        getBounds: () => ({
            getEast: () => 55.05,
            getNorth: () => 51.18,
            getSouth: () => 51.12,
            getWest: () => 54.95
        }),
        getZoom: () => mockZoom
    }))
}))

jest.mock('leaflet', () => ({
    __esModule: true,
    default: {
        divIcon: (options: object) => ({ ...options })
    }
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        i18n: { language: 'ru' },
        t: (key: string, opts?: Record<string, unknown>) =>
            String(opts?.defaultValue ?? key).replace(/{{(\w+)}}/g, (_, name: string) => String(opts?.[name] ?? ''))
    })
}))

jest.mock('./CandidatePopup', () => ({ CandidatePopup: () => null }))

jest.mock('@/api', () => ({
    API: { useOsmCandidatesGetListQuery: jest.fn() },
    ApiModel: { Categories: {} }
}))

let mockZoom = 12

const candidate = (
    id: string,
    tier: ApiType.OsmCandidates.Tier,
    status: ApiType.OsmCandidates.Status = 'open'
): ApiType.OsmCandidates.Candidate => ({
    breakdown: [],
    category: 'memorial',
    ele: null,
    heritage: null,
    id,
    image: null,
    lat: 51.15,
    lon: 55.0,
    name: `Место ${id}`,
    osmId: 1,
    osmTag: 'historic=monument',
    osmType: 'node',
    photos: [],
    place: null,
    score: 5,
    settlement: null,
    size: null,
    source: 'osm',
    status,
    tier,
    typeTitle: 'Монумент',
    wikidata: null,
    wikipedia: null
})

const mockList = (items: ApiType.OsmCandidates.Candidate[], pendingTiles = 0) =>
    (API.useOsmCandidatesGetListQuery as jest.Mock).mockReturnValue({
        data: { items, pendingTiles },
        isError: false,
        isFetching: false
    })

const items = [
    candidate('1', 'known'),
    candidate('2', 'known'),
    candidate('3', 'explore'),
    candidate('4', 'other'),
    candidate('5', 'known', 'duplicate')
]

describe('OsmCandidates', () => {
    beforeEach(() => {
        mockZoom = 12
        mockList(items)
    })

    it('shows the open known and unexplored places as white spots, without a panel', () => {
        render(<OsmCandidates />)

        expect(screen.getAllByTestId('white-spot-marker')).toHaveLength(3)
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    })

    it('titles the markers with the place name', () => {
        render(<OsmCandidates />)

        expect(screen.getAllByTestId('candidate-tooltip').map((node) => node.textContent)).toEqual([
            'Место 1',
            'Место 2',
            'Место 3'
        ])
    })

    it('asks for the map area widened to whole tiles, with the known and unexplored tiers only', () => {
        render(<OsmCandidates />)

        expect(API.useOsmCandidatesGetListQuery).toHaveBeenLastCalledWith(
            { bounds: '51.1,54.9,51.2,55.1', tiers: 'known,explore' },
            expect.objectContaining({ skip: false })
        )
    })

    it('does not move or restyle the markers when the layer re-renders', () => {
        const { rerender } = render(<OsmCandidates />)
        const marker = screen.getAllByTestId('white-spot-marker')[0]
        const center = marker.getAttribute('data-center')
        const options = marker.getAttribute('data-options')

        rerender(<OsmCandidates />)

        const same = screen.getAllByTestId('white-spot-marker')[0]
        expect(same.getAttribute('data-center')).toBe(center)
        expect(same.getAttribute('data-options')).toBe(options)
    })

    it('polls only while the area is being collected', () => {
        mockList(items, 2)
        render(<OsmCandidates />)

        expect(API.useOsmCandidatesGetListQuery).toHaveBeenLastCalledWith(
            expect.anything(),
            expect.objectContaining({ pollingInterval: 30000, skipPollingIfUnfocused: true })
        )
    })

    it('does not poll when nothing is being collected', () => {
        render(<OsmCandidates />)

        expect(API.useOsmCandidatesGetListQuery).toHaveBeenLastCalledWith(
            expect.anything(),
            expect.objectContaining({ pollingInterval: 0 })
        )
    })

    it('does not load and shows nothing on a small zoom', () => {
        mockZoom = 8
        render(<OsmCandidates />)

        act(() => undefined)

        expect(screen.queryAllByTestId('white-spot-marker')).toHaveLength(0)
        expect(API.useOsmCandidatesGetListQuery).toHaveBeenLastCalledWith(
            expect.anything(),
            expect.objectContaining({ skip: true })
        )
    })
})
