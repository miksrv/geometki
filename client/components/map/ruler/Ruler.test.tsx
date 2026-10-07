import React from 'react'

import { act, fireEvent, render, screen } from '@testing-library/react'

import { Ruler } from './Ruler'

type LatLngLike = { lat: number; lng: number }
type MapHandlers = {
    click?: (event: { latlng: LatLngLike; originalEvent: { target: Node } }) => void
    mousemove?: (event: { latlng: LatLngLike; originalEvent: { target: Node } }) => void
    mouseout?: () => void
}

let mapHandlers: MapHandlers = {}

const mapPane = document.createElement('div')
const mapContainer = document.createElement('div')

// 1 degree of latitude or longitude = 1000 m, 1 degree = 100 px: easy numbers
const mockMap = {
    distance: (a: LatLngLike, b: LatLngLike) => Math.hypot(a.lat - b.lat, a.lng - b.lng) * 1000,
    latLngToContainerPoint: (p: LatLngLike) => ({
        distanceTo: (other: { x: number; y: number }) => Math.hypot(p.lng * 100 - other.x, p.lat * 100 - other.y),
        x: p.lng * 100,
        y: p.lat * 100
    }),
    doubleClickZoom: { disable: jest.fn(), enable: jest.fn(), enabled: () => true },
    getContainer: () => mapContainer,
    getPane: () => mapPane,
    hasLayer: () => false
}

jest.mock('react-leaflet', () => ({
    Marker: ({ children }: { children?: React.ReactNode }) => <div data-testid={'vertex'}>{children}</div>,
    Pane: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Polyline: () => <div data-testid={'line'} />,
    Tooltip: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    useMap: () => mockMap,
    useMapEvents: (handlers: MapHandlers) => {
        mapHandlers = handlers
        return mockMap
    }
}))

jest.mock('leaflet', () => {
    const layer = () => ({
        addTo: jest.fn().mockReturnThis(),
        remove: jest.fn(),
        setContent: jest.fn(),
        setLatLng: jest.fn(),
        setLatLngs: jest.fn()
    })
    const L = {
        DomEvent: { disableClickPropagation: jest.fn(), disableScrollPropagation: jest.fn() },
        divIcon: jest.fn(() => ({})),
        polyline: jest.fn(layer),
        tooltip: jest.fn(layer)
    }
    return { __esModule: true, default: L, ...L }
})

jest.mock('simple-react-ui-kit', () => ({
    Button: ({ label, onClick }: { label?: string; onClick?: () => void }) => <button onClick={onClick}>{label}</button>
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        i18n: { language: 'ru' },
        t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key
    })
}))

const clickMap = (lat: number, lng: number, target: Node = mapPane) =>
    act(() => mapHandlers.click?.({ latlng: { lat, lng }, originalEvent: { target } }))

describe('Ruler', () => {
    beforeEach(() => {
        mapHandlers = {}
    })

    it('shows no panel until there is a distance, and turns off double-click zoom', () => {
        render(<Ruler />)

        expect(screen.queryByText('Расстояние')).not.toBeInTheDocument()
        expect(mockMap.doubleClickZoom.disable).toHaveBeenCalled()
        expect(mapContainer.className).not.toBe('')

        clickMap(0, 0)
        expect(screen.queryByText('Сбросить')).not.toBeInTheDocument()
    })

    it('counts clicks that land on the map container (tiles let clicks through to it)', () => {
        render(<Ruler />)

        clickMap(0, 0, mapContainer)

        expect(screen.getAllByTestId('vertex')).toHaveLength(1)
    })

    it('adds points on clicks and shows the total distance', () => {
        render(<Ruler />)

        clickMap(0, 0)
        clickMap(0, 1)
        clickMap(1, 1)

        expect(screen.getAllByTestId('vertex')).toHaveLength(3)
        // 1000 m + 1000 m
        expect(screen.getByText('2,00 км', { selector: 'b' })).toBeInTheDocument()
    })

    it('ignores clicks on map controls', () => {
        render(<Ruler />)

        clickMap(0, 0, document.createElement('button'))

        expect(screen.queryByTestId('vertex')).not.toBeInTheDocument()
    })

    it('finishes the line on a click next to the last point instead of adding one', () => {
        render(<Ruler />)

        clickMap(0, 0)
        clickMap(0, 1)
        // 0.01° = 1 px away: the second click of a double click
        clickMap(0, 1.01)

        expect(screen.getAllByTestId('vertex')).toHaveLength(2)
    })

    it('removes the last point with Backspace and the button', () => {
        render(<Ruler />)

        clickMap(0, 0)
        clickMap(0, 1)
        clickMap(0, 2)

        fireEvent.keyDown(document, { key: 'Backspace' })
        expect(screen.getAllByTestId('vertex')).toHaveLength(2)

        fireEvent.click(screen.getByText('Отменить точку'))
        expect(screen.getAllByTestId('vertex')).toHaveLength(1)
        // One point left: no distance, no panel
        expect(screen.queryByText('Отменить точку')).not.toBeInTheDocument()
    })

    it('clears everything with Esc and the button', () => {
        render(<Ruler />)

        clickMap(0, 0)
        clickMap(0, 1)

        fireEvent.keyDown(document, { key: 'Escape' })
        expect(screen.queryByTestId('vertex')).not.toBeInTheDocument()

        clickMap(0, 0)
        clickMap(0, 1)
        fireEvent.click(screen.getByText('Сбросить'))
        expect(screen.queryByTestId('vertex')).not.toBeInTheDocument()
    })

    it('restores double-click zoom when turned off', () => {
        const { unmount } = render(<Ruler />)

        unmount()

        expect(mockMap.doubleClickZoom.enable).toHaveBeenCalled()
        expect(mapContainer.className).toBe('')
    })
})
