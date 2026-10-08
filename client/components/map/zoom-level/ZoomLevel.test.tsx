import React from 'react'
import { useMap } from 'react-leaflet'

import { act, render } from '@testing-library/react'

import { ZoomLevel } from './ZoomLevel'

jest.mock('react-leaflet', () => ({ useMap: jest.fn() }))

const makeMap = (zoom: number) => {
    const container = document.createElement('div')
    container.innerHTML = '<a class="leaflet-control-zoom-in"></a><a class="leaflet-control-zoom-out"></a>'

    const handlers: Record<string, () => void> = {}
    const map = {
        getZoom: jest.fn(() => zoom),
        off: jest.fn(),
        on: jest.fn((event: string, handler: () => void) => {
            handlers[event] = handler
        }),
        zoomControl: { getContainer: () => container }
    }

    ;(useMap as jest.Mock).mockReturnValue(map)

    return { container, handlers, map }
}

describe('ZoomLevel', () => {
    it('shows the zoom between the zoom buttons', () => {
        const { container } = makeMap(12)
        render(<ZoomLevel />)

        const level = container.querySelector('.leaflet-control-zoom-in + div')

        expect(level).toHaveTextContent('12')
        expect(level?.nextElementSibling).toHaveClass('leaflet-control-zoom-out')
    })

    it('updates the zoom when the map is zoomed', () => {
        const { container, handlers, map } = makeMap(12)
        render(<ZoomLevel />)

        map.getZoom.mockReturnValue(15)
        act(() => handlers.zoomend())

        expect(container.querySelector('.leaflet-control-zoom-in + div')).toHaveTextContent('15')
    })

    it('removes the zoom level on unmount', () => {
        const { container, map } = makeMap(12)
        const { unmount } = render(<ZoomLevel />)

        unmount()

        expect(container.querySelectorAll('div')).toHaveLength(0)
        expect(map.off).toHaveBeenCalledWith('zoomend', expect.any(Function))
    })

    it('does nothing without the zoom control', () => {
        ;(useMap as jest.Mock).mockReturnValue({ zoomControl: undefined })

        expect(() => render(<ZoomLevel />)).not.toThrow()
    })
})
