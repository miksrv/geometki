import React from 'react'
import * as Leaflet from 'leaflet'

import { render, screen } from '@testing-library/react'

import { MarkerUser } from './MarkerUser'

jest.mock('react-leaflet', () => ({
    Marker: ({ position }: any) => (
        <div
            data-testid={'user-marker'}
            data-lat={position[0]}
            data-lon={position[1]}
        />
    ),
    Circle: ({ center, radius }: any) => (
        <div
            data-testid={'user-circle'}
            data-lat={center[0]}
            data-lon={center[1]}
            data-radius={radius}
        />
    )
}))

jest.mock('leaflet', () => ({
    Icon: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('@/public/images/no-avatar.png', () => ({ src: '/images/no-avatar.png' }), { virtual: true })

describe('MarkerUser', () => {
    const coordinates = { lat: 51.765, lon: 55.099 }

    it('renders a Marker at the user coordinates', () => {
        render(<MarkerUser coordinates={coordinates} />)
        const marker = screen.getByTestId('user-marker')
        expect(marker).toHaveAttribute('data-lat', '51.765')
        expect(marker).toHaveAttribute('data-lon', '55.099')
    })

    it('renders a Circle at the user coordinates', () => {
        render(<MarkerUser coordinates={coordinates} />)
        const circle = screen.getByTestId('user-circle')
        expect(circle).toHaveAttribute('data-lat', '51.765')
        expect(circle).toHaveAttribute('data-lon', '55.099')
    })

    it('renders the circle with a 500m radius', () => {
        render(<MarkerUser coordinates={coordinates} />)
        expect(screen.getByTestId('user-circle')).toHaveAttribute('data-radius', '500')
    })

    it('creates an Icon with the avatar url', () => {
        render(<MarkerUser coordinates={coordinates} />)
        expect(Leaflet.Icon).toHaveBeenCalledWith(expect.objectContaining({ iconUrl: '/images/no-avatar.png' }))
    })
})
