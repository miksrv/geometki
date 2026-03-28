import React from 'react'
import { useMapEvents } from 'react-leaflet'

import { render } from '@testing-library/react'

import { MapEvents } from './MapEvents'

const mockMapEvents = {
    closePopup: jest.fn(),
    getBounds: jest.fn().mockReturnValue({ getCenter: () => ({ lat: 51.765, lng: 55.099 }) }),
    getZoom: jest.fn().mockReturnValue(12)
}

jest.mock('react-leaflet', () => ({
    useMapEvents: jest.fn().mockImplementation((_handlers: Record<string, (...args: unknown[]) => unknown>) => {
        return mockMapEvents
    })
}))

jest.mock('leaflet', () => ({}))

jest.mock('@/utils/helpers', () => ({
    round: jest.fn((val: number, precision: number) => Math.round(val * 10 ** precision) / 10 ** precision)
}))

describe('MapEvents', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.mocked(useMapEvents).mockImplementation(
            (_handlers: Record<string, (...args: unknown[]) => unknown>) => mockMapEvents
        )
    })

    it('renders null', () => {
        const { container } = render(<MapEvents />)
        expect(container.innerHTML).toBe('')
    })

    it('calls onChangeBounds on mount via useEffect', () => {
        const onChangeBounds = jest.fn()
        render(<MapEvents onChangeBounds={onChangeBounds} />)
        expect(onChangeBounds).toHaveBeenCalled()
    })

    it('registers moveend event handler', () => {
        render(<MapEvents onChangeBounds={jest.fn()} />)
        const registeredHandlers = jest.mocked(useMapEvents).mock.calls[0][0]
        expect(registeredHandlers).toHaveProperty('moveend')
    })

    it('registers mousemove event handler', () => {
        render(<MapEvents onMouseMove={jest.fn()} />)
        const registeredHandlers = jest.mocked(useMapEvents).mock.calls[0][0]
        expect(registeredHandlers).toHaveProperty('mousemove')
    })

    it('calls onMouseMove when mousemove handler is triggered', () => {
        const onMouseMove = jest.fn()
        render(<MapEvents onMouseMove={onMouseMove} />)
        const { mousemove } = jest.mocked(useMapEvents).mock.calls[0][0]
        mousemove({ latlng: { lat: 51.765, lng: 55.099 } })
        expect(onMouseMove).toHaveBeenCalledWith(
            expect.objectContaining({ lat: expect.any(Number), lon: expect.any(Number) })
        )
    })
})
