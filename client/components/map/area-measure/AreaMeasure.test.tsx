import React from 'react'

import { act, fireEvent, render, screen } from '@testing-library/react'

import { AreaMeasure } from './AreaMeasure'

type LatLngLike = { lat: number; lng: number }
type MapHandlers = {
    click?: (event: { latlng: LatLngLike; originalEvent: { target: Node } }) => void
    mousemove?: (event: { latlng: LatLngLike; originalEvent: { target: Node } }) => void
    mouseout?: () => void
}
type MarkerProps = {
    icon: { className: string }
    position: LatLngLike
    eventHandlers: {
        click?: () => void
        dragend?: (event: { target: { getLatLng: () => LatLngLike } }) => void
    }
}

let mapHandlers: MapHandlers = {}

const mapPane = document.createElement('div')
const mapContainer = document.createElement('div')

// 1 degree of latitude or longitude = 1000 m, 1 degree = 100 px: easy numbers
const point = (x: number, y: number) => ({
    add: (other: { x: number; y: number }) => point(x + other.x, y + other.y),
    divideBy: (n: number) => point(x / n, y / n),
    distanceTo: (other: { x: number; y: number }) => Math.hypot(x - other.x, y - other.y),
    x,
    y
})
const mockMap = {
    distance: (a: LatLngLike, b: LatLngLike) => Math.hypot(a.lat - b.lat, a.lng - b.lng) * 1000,
    latLngToContainerPoint: (p: LatLngLike) => point(p.lng * 100, p.lat * 100),
    project: (p: LatLngLike) => point(p.lng * 100, p.lat * 100),
    unproject: (p: { x: number; y: number }) => ({ lat: p.y / 100, lng: p.x / 100 }),
    doubleClickZoom: { disable: jest.fn(), enable: jest.fn(), enabled: () => true },
    getContainer: () => mapContainer,
    getPane: () => mapPane,
    hasLayer: () => false
}

jest.mock('react-leaflet', () => ({
    // Vertices and edge handles are told apart by their icon class
    Marker: ({ icon, position, eventHandlers }: MarkerProps) => (
        <button
            data-testid={icon.className}
            data-position={`${position.lat},${position.lng}`}
            onClick={eventHandlers.click}
            onDragEnd={() => eventHandlers.dragend?.({ target: { getLatLng: () => ({ lat: 5, lng: 5 }) } })}
        />
    ),
    Pane: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Polygon: ({ children, pathOptions }: { children?: React.ReactNode; pathOptions: { className: string } }) => (
        <div data-testid={pathOptions.className}>{children}</div>
    ),
    Polyline: () => <div data-testid={'line'} />,
    Tooltip: ({ children }: { children?: React.ReactNode }) => <span data-testid={'area-label'}>{children}</span>,
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
        divIcon: jest.fn((options: { className: string }) => options),
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

const vertices = () => screen.queryAllByTestId('vertex')
const handles = () => screen.queryAllByTestId('midpoint')

/** A closed 1 × 1 km square (a click next to the last point closes it) */
const drawSquare = () => {
    clickMap(0, 0)
    clickMap(0, 1)
    clickMap(1, 1)
    clickMap(1, 0)
    clickMap(1, 0.01)
}

describe('AreaMeasure', () => {
    beforeEach(() => {
        mapHandlers = {}
    })

    it('shows no panel until there are three points, and turns off double-click zoom', () => {
        render(<AreaMeasure />)

        expect(mockMap.doubleClickZoom.disable).toHaveBeenCalled()
        expect(mapContainer.className).not.toBe('')

        clickMap(0, 0)
        clickMap(0, 1)
        expect(screen.queryByText('Площадь')).not.toBeInTheDocument()
        expect(screen.getByTestId('line')).toBeInTheDocument()

        clickMap(1, 1)
        expect(screen.getByText('Площадь', { exact: false })).toBeInTheDocument()
        expect(screen.getByTestId('draftPolygon')).toBeInTheDocument()
    })

    it('ignores clicks on map controls', () => {
        render(<AreaMeasure />)

        clickMap(0, 0, document.createElement('button'))

        expect(vertices()).toHaveLength(0)
    })

    it('closes the polygon on a double click and shows its area and perimeter', () => {
        render(<AreaMeasure />)

        drawSquare()

        expect(vertices()).toHaveLength(4)
        expect(screen.getByTestId('polygon')).toBeInTheDocument()
        // ~1 km², the mock map is flat in pixels but the area is geodesic
        expect(screen.getByTestId('area-label').textContent).toMatch(/км²$/)
        expect(screen.getByText('4,00 км', { selector: 'b' })).toBeInTheDocument()
    })

    it('does not close a polygon of two points', () => {
        render(<AreaMeasure />)

        clickMap(0, 0)
        clickMap(0, 1)
        clickMap(0, 1.01)
        clickMap(1, 1)

        expect(vertices()).toHaveLength(3)
        expect(screen.getByTestId('draftPolygon')).toBeInTheDocument()
    })

    it('closes the polygon on a click on its first point', () => {
        render(<AreaMeasure />)

        clickMap(0, 0)
        clickMap(0, 1)
        clickMap(1, 1)
        fireEvent.click(vertices()[0])

        expect(screen.getByTestId('polygon')).toBeInTheDocument()
    })

    it('ignores map clicks once the polygon is closed', () => {
        render(<AreaMeasure />)

        drawSquare()
        clickMap(5, 5)

        expect(vertices()).toHaveLength(4)
    })

    it('removes a point on a click, but keeps three in a closed polygon', () => {
        render(<AreaMeasure />)

        drawSquare()

        fireEvent.click(vertices()[1])
        expect(vertices()).toHaveLength(3)

        fireEvent.click(vertices()[1])
        expect(vertices()).toHaveLength(3)
    })

    it('adds a point in the middle of an edge on a handle click', () => {
        render(<AreaMeasure />)

        drawSquare()
        // A closed square has a handle on each of its four edges
        expect(handles()).toHaveLength(4)

        fireEvent.click(handles()[0])

        expect(vertices()).toHaveLength(5)
        expect(vertices()[1].dataset.position).toBe('0,0.5')
    })

    it('adds a point where an edge handle is dropped', () => {
        render(<AreaMeasure />)

        drawSquare()
        fireEvent.dragEnd(handles()[1])

        expect(vertices()).toHaveLength(5)
        expect(vertices()[2].dataset.position).toBe('5,5')
    })

    it('reopens the polygon when undo leaves fewer than three points', () => {
        render(<AreaMeasure />)

        clickMap(0, 0)
        clickMap(0, 1)
        clickMap(1, 1)
        clickMap(1, 1.01)
        expect(screen.getByTestId('polygon')).toBeInTheDocument()

        fireEvent.keyDown(document, { key: 'Backspace' })
        expect(vertices()).toHaveLength(2)

        clickMap(1, 0)
        expect(vertices()).toHaveLength(3)
        expect(screen.getByTestId('draftPolygon')).toBeInTheDocument()
    })

    it('clears everything with Esc and the button', () => {
        render(<AreaMeasure />)

        drawSquare()
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(vertices()).toHaveLength(0)

        drawSquare()
        fireEvent.click(screen.getByText('Сбросить'))
        expect(vertices()).toHaveLength(0)
    })

    it('restores double-click zoom when turned off', () => {
        const { unmount } = render(<AreaMeasure />)

        unmount()

        expect(mockMap.doubleClickZoom.enable).toHaveBeenCalled()
        expect(mapContainer.className).toBe('')
    })
})
