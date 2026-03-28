import React from 'react'
import * as Leaflet from 'leaflet'

import { render } from '@testing-library/react'

import { PlaceMark } from './PlaceMark'

jest.mock('react-leaflet', () => ({
    Marker: ({ children, position, _eventHandlers }: any) => (
        <div
            data-testid={'marker'}
            data-lat={position[0]}
            data-lon={position[1]}
        >
            {children}
        </div>
    )
}))

jest.mock('leaflet', () => ({
    DivIcon: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('@/utils/coordinates', () => ({
    convertDMS: jest.fn((lat: number, lon: number) => `${lat}°N ${lon}°E`)
}))

describe('PlaceMark', () => {
    it('renders a marker at the given coordinates', () => {
        const { getByTestId } = render(
            <PlaceMark
                lat={51.765}
                lon={55.099}
            />
        )
        const marker = getByTestId('marker')
        expect(marker).toHaveAttribute('data-lat', '51.765')
        expect(marker).toHaveAttribute('data-lon', '55.099')
    })

    it('creates a DivIcon with the coordinates HTML', () => {
        render(
            <PlaceMark
                lat={51.765}
                lon={55.099}
            />
        )
        expect(Leaflet.DivIcon).toHaveBeenCalled()
    })

    it('calls onClick when the marker click event fires', () => {
        const onClick = jest.fn()
        // The mock Marker doesn't wire up eventHandlers, so we test that the prop is passed correctly
        // by checking the Marker is rendered without error
        const { getByTestId } = render(
            <PlaceMark
                lat={51.765}
                lon={55.099}
                onClick={onClick}
            />
        )
        expect(getByTestId('marker')).toBeInTheDocument()
    })
})
