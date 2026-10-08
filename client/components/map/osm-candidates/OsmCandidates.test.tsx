import React from 'react'

import { act, fireEvent, render, screen } from '@testing-library/react'

import { API, ApiType } from '@/api'
import { useAppSelector } from '@/app/store'

import { MapControlsContext } from '../MapControlsContext'

import { OsmCandidates } from './OsmCandidates'

jest.mock('react-leaflet', () => ({
    CircleMarker: ({ children, pathOptions }: { children?: React.ReactNode; pathOptions: { fillColor: string } }) => (
        <div
            data-testid={'candidate-marker'}
            data-color={pathOptions.fillColor}
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
    default: { DomEvent: { disableClickPropagation: jest.fn(), disableScrollPropagation: jest.fn() } }
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        i18n: { language: 'ru' },
        t: (key: string, opts?: Record<string, unknown>) =>
            String(opts?.defaultValue ?? key).replace(/{{(\w+)}}/g, (_, name: string) => String(opts?.[name] ?? ''))
    })
}))

jest.mock('simple-react-ui-kit', () => ({
    Button: ({ onClick, 'aria-label': ariaLabel }: { onClick?: () => void; 'aria-label'?: string }) => (
        <button
            aria-label={ariaLabel}
            onClick={onClick}
        />
    ),
    cn: (...args: unknown[]) => args.filter(Boolean).join(' ')
}))

jest.mock('./CandidatePopup', () => ({ CandidatePopup: () => null }))

jest.mock('@/app/store', () => ({ useAppSelector: jest.fn() }))

jest.mock('@/api', () => ({
    API: { useOsmCandidatesGetListQuery: jest.fn() }
}))

let mockZoom = 12

const candidate = (
    id: string,
    tier: ApiType.OsmCandidates.Tier,
    status: ApiType.OsmCandidates.Status = 'open'
): ApiType.OsmCandidates.Candidate => ({
    breakdown: [],
    category: 'monument',
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

const mockRole = (role?: string) =>
    (useAppSelector as jest.Mock).mockImplementation((selector: (state: unknown) => unknown) =>
        selector({ auth: { user: role ? { role } : undefined } })
    )

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
        mockRole()
        mockList(items)
    })

    it('shows the known and unexplored places by default', () => {
        render(<OsmCandidates />)

        expect(screen.getAllByTestId('candidate-marker')).toHaveLength(3)
        expect(screen.getByText('Хорошо описанные: 2')).toBeInTheDocument()
        expect(screen.getByText('Неисследованные: 1')).toBeInTheDocument()
        expect(screen.getByText('Найдено мест: 4')).toBeInTheDocument()
    })

    it('asks for the rounded map area with all tiers', () => {
        render(<OsmCandidates />)

        expect(API.useOsmCandidatesGetListQuery).toHaveBeenLastCalledWith(
            { bounds: '51.12,54.95,51.18,55.05', tiers: 'known,explore,other' },
            expect.objectContaining({ skip: false })
        )
    })

    it('shows the other objects when their group is switched on', () => {
        render(<OsmCandidates />)

        fireEvent.click(screen.getByLabelText('Прочие объекты: 1', { exact: false }))

        expect(screen.getAllByTestId('candidate-marker')).toHaveLength(4)
    })

    it('hides the "already on Geometki" group from users', () => {
        render(<OsmCandidates />)

        expect(screen.queryByText(/Уже на Геометках/)).not.toBeInTheDocument()
    })

    it('shows the "already on Geometki" group to admins', () => {
        mockRole('admin')
        render(<OsmCandidates />)

        expect(screen.getByText('Уже на Геометках: 1')).toBeInTheDocument()
    })

    it('collapses into a button with the counter of new places', () => {
        render(<OsmCandidates />)

        fireEvent.click(screen.getByLabelText('Свернуть'))

        expect(screen.queryByText(/Хорошо описанные/)).not.toBeInTheDocument()
        expect(screen.getByText('3')).toBeInTheDocument()

        fireEvent.click(screen.getByLabelText('Места для исследования'))

        expect(screen.getByText('Хорошо описанные: 2')).toBeInTheDocument()
    })

    it('puts the legend into the map slot above the coordinates', () => {
        const slot = document.createElement('div')
        document.body.appendChild(slot)

        render(
            <MapControlsContext.Provider value={{ bottomSlot: slot }}>
                <OsmCandidates />
            </MapControlsContext.Provider>
        )

        expect(slot).toHaveTextContent('Места для исследования')
        slot.remove()
    })

    it('tells that the area is being collected', () => {
        mockList(items, 2)
        render(<OsmCandidates />)

        expect(screen.getByText('Собираем данные…')).toBeInTheDocument()
    })

    it('asks to zoom in on a small zoom and does not load', () => {
        mockZoom = 8
        render(<OsmCandidates />)

        act(() => undefined)

        expect(screen.getByText('Приблизьте карту')).toBeInTheDocument()
        expect(screen.queryAllByTestId('candidate-marker')).toHaveLength(0)
        expect(API.useOsmCandidatesGetListQuery).toHaveBeenLastCalledWith(
            expect.anything(),
            expect.objectContaining({ skip: true })
        )
    })
})
