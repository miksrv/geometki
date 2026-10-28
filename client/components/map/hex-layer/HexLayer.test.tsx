import React from 'react'

import { act, fireEvent, render, screen } from '@testing-library/react'

import { HEX_PLACE_COLOR, HEX_SPOT_COLOR, HEX_VISITED_COLOR } from './constants'
import { HEX_MAX_ZOOM, hexFill, HexLayer } from './HexLayer'

let mockZoom = 8
let mockData: any
let mockVisited: any
let mockUserId: string | undefined

const mockSetView = jest.fn()
// 1000 pixels per degree at zoom 8, halved per zoom level below it, like Leaflet's CRS
const mockProject = jest.fn(([lat, lon]: [number, number], zoom: number) => ({
    x: lon * 1000 * 2 ** (zoom - 8),
    y: lat * 1000 * 2 ** (zoom - 8)
}))
let mockHandlers: Record<string, () => void> = {}
// The `positions` of every polygon rendered, in order: the same objects mean react-leaflet redraws nothing
let mockPositions: unknown[] = []

const mockCloseTooltip = jest.fn()
// The layers on the map: what a move sweeps the open hints from
let mockLayers: unknown[] = []

const mockMap = {
    closeTooltip: (...args: unknown[]) => mockCloseTooltip(...args),
    eachLayer: (fn: (layer: unknown) => void) => mockLayers.forEach(fn),
    getPixelBounds: () => ({ max: { x: 100000, y: 100000 }, min: { x: -100000, y: -100000 } }),
    getZoom: () => mockZoom,
    project: (...args: [[number, number], number]) => mockProject(args[0], args[1]),
    setView: (...args: unknown[]) => mockSetView(...args),
    unproject: ([x, y]: [number, number], zoom: number) => ({
        lat: y / 1000 / 2 ** (zoom - 8),
        lng: x / 1000 / 2 ** (zoom - 8)
    })
}

jest.mock('@/utils/hexGrid', () => {
    const actual = jest.requireActual('@/utils/hexGrid')

    return { ...actual, binByHex: jest.fn(actual.binByHex) }
})

const mockBinByHex = jest.requireMock('@/utils/hexGrid').binByHex as jest.Mock

jest.mock('react-leaflet', () => ({
    Pane: ({ children }: any) => <>{children}</>,
    Polygon: ({ children, eventHandlers, pathOptions, positions }: any) => (
        <div
            data-testid={'hex-polygon'}
            data-fill={pathOptions?.fillColor}
            data-edge={pathOptions?.color}
            ref={(el: HTMLDivElement | null) => {
                if (el) {
                    mockPositions.push(positions)
                }
            }}
            onClick={eventHandlers?.click}
        >
            {children}
        </div>
    ),
    Tooltip: ({ children }: any) => <span data-testid={'hex-tooltip'}>{children}</span>,
    useMap: () => mockMap,
    useMapEvents: (handlers: Record<string, () => void>) => {
        mockHandlers = handlers

        return mockMap
    }
}))

jest.mock('@/api', () => ({
    API: {
        useExplorationGetPointsQuery: () => ({ data: mockData }),
        usePoiGetListQuery: (params: { visited?: string }, options?: { skip?: boolean }) => ({
            data: options?.skip ? undefined : mockVisited
        })
    }
}))

jest.mock('@/app/store', () => ({
    useAppSelector: (selector: (state: unknown) => unknown) =>
        selector({ auth: { user: mockUserId ? { id: mockUserId } : undefined } })
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { count?: number }) => `${key}:${options?.count}`
    })
}))

jest.mock('../osm-candidates/constants', () => ({ OSM_CANDIDATES_MIN_ZOOM: 11 }))

describe('HexLayer', () => {
    beforeEach(() => {
        mockZoom = 8
        mockUserId = undefined
        mockVisited = { count: 1, items: [{ category: 'cave', id: 'p1', lat: 10, lon: 10 }] }
        mockSetView.mockClear()
        mockCloseTooltip.mockClear()
        mockProject.mockClear()
        mockBinByHex.mockClear()
        mockPositions = []
        // Two cells far apart: Moscow-ish (places + spots) and a lone spot
        mockData = {
            places: [
                [10, 10, 'cave'],
                [10, 10.001, 'waterfall'],
                [10, 10.002, null]
            ],
            spots: [
                [10, 10.001, 'cave'],
                [50, 50, 'cave']
            ]
        }
    })

    it('shows the hexagons below the points zoom only', () => {
        expect(HEX_MAX_ZOOM).toBe(11)
        mockZoom = 11
        render(<HexLayer />)
        expect(screen.queryByTestId('hex-polygon')).not.toBeInTheDocument()
    })

    it('draws one polygon per non-empty cell', () => {
        render(<HexLayer />)
        expect(screen.getAllByTestId('hex-polygon')).toHaveLength(2)
    })

    it('puts the counts in the tooltip', () => {
        render(<HexLayer />)
        const tips = screen.getAllByTestId('hex-tooltip').map((el) => el.textContent)

        expect(tips).toContain('hex_places:3hex_spots:1')
        expect(tips).toContain('hex_spots:1')
    })

    it('drops the points of other categories, and the uncategorised ones', () => {
        render(<HexLayer categories={['cave' as any]} />)
        const tips = screen.getAllByTestId('hex-tooltip').map((el) => el.textContent)

        expect(tips).toEqual(['hex_places:1hex_spots:1', 'hex_spots:1'])
    })

    it("tints the cells with the visitor's own visits blue and counts them first in the tooltip", () => {
        mockUserId = 'u1'
        render(<HexLayer />)

        const tips = screen.getAllByTestId('hex-tooltip').map((el) => el.textContent)
        expect(tips).toContain('hex_visited:1hex_places:3hex_spots:1')
        expect(tips).toContain('hex_spots:1')

        const [visitedCell] = screen.getAllByTestId('hex-polygon')
        expect(visitedCell.dataset.fill).toBe(hexFill(3, 1, 1))
        expect(visitedCell.dataset.edge).toBe(HEX_VISITED_COLOR)
    })

    it('paints a cell of spots only pale', () => {
        render(<HexLayer />)

        expect(screen.getAllByTestId('hex-polygon').map((el) => el.dataset.fill)).toEqual([
            hexFill(3, 1, 0),
            HEX_SPOT_COLOR
        ])
    })

    describe('hexFill', () => {
        it('gives one state its own colour', () => {
            expect(hexFill(0, 5, 0)).toBe(HEX_SPOT_COLOR)
            expect(hexFill(5, 0, 0)).toBe(HEX_PLACE_COLOR)
            expect(hexFill(5, 0, 5)).toBe(HEX_VISITED_COLOR)
        })

        it('mixes the pale and the green by the share on the map, in quarters, in OKLab', () => {
            // Half on the map: halfway between the two greens, no grey in the middle
            expect(hexFill(1, 1, 0)).toBe('#89c5aa')
            // 40% is a half too
            expect(hexFill(2, 3, 0)).toBe(hexFill(1, 1, 0))
        })

        it('tints a cell with a single visit among many places', () => {
            expect(hexFill(50, 0, 1)).not.toBe(HEX_PLACE_COLOR)
            expect(hexFill(50, 0, 1)).toBe(hexFill(4, 0, 1))
        })

        it('never counts more visited places than there are places', () => {
            expect(hexFill(1, 1, 3)).toBe(hexFill(1, 1, 1))
        })
    })

    it('closes the open hints when the map starts to move', () => {
        const { Tooltip } = jest.requireActual('leaflet')
        const hint = new Tooltip()
        mockLayers = [hint, {}]

        render(<HexLayer />)
        act(() => mockHandlers.movestart())
        expect(mockCloseTooltip).toHaveBeenCalledTimes(1)
        expect(mockCloseTooltip).toHaveBeenCalledWith(hint)

        act(() => mockHandlers.zoomstart())
        expect(mockCloseTooltip).toHaveBeenCalledTimes(2)
        mockLayers = []
    })

    it('zooms in by two on a click', () => {
        render(<HexLayer />)
        fireEvent.click(screen.getAllByTestId('hex-polygon')[0])
        expect(mockSetView).toHaveBeenCalledWith([expect.any(Number), expect.any(Number)], 10)
    })

    it('does not bin the points again when the view is unchanged', () => {
        render(<HexLayer />)
        const binned = mockBinByHex.mock.calls.length

        expect(binned).toBeGreaterThan(0)

        // A zoom ends with `zoomend` and `moveend`, both read the same view
        act(() => {
            mockHandlers.zoomend()
            mockHandlers.moveend()
        })

        expect(mockBinByHex.mock.calls.length).toBe(binned)

        mockZoom = 9
        act(() => mockHandlers.zoomend())

        expect(mockBinByHex.mock.calls.length).toBeGreaterThan(binned)
    })

    it('projects the points once per answer, not once per move', () => {
        render(<HexLayer />)
        const projected = mockProject.mock.calls.length

        expect(projected).toBeGreaterThan(0)

        mockZoom = 9
        act(() => mockHandlers.zoomend())

        expect(mockProject.mock.calls.length).toBe(projected)
    })

    it('keeps the shapes of the cells that stay in view across a pan', () => {
        render(<HexLayer />)
        const before = [...mockPositions]

        expect(before).toHaveLength(2)

        // A pan: the view moves, the cells stay, their corners are the same objects
        mockMap.getPixelBounds = () => ({ max: { x: 100100, y: 100100 }, min: { x: -99900, y: -99900 } })
        act(() => mockHandlers.moveend())
        mockMap.getPixelBounds = () => ({ max: { x: 100000, y: 100000 }, min: { x: -100000, y: -100000 } })

        const after = mockPositions.slice(before.length)
        expect(after).toHaveLength(2)
        expect(after[0]).toBe(before[0])
        expect(after[1]).toBe(before[1])
    })
})
