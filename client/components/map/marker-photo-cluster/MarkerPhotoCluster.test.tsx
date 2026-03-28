import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('react-leaflet', () => ({
    Marker: ({ position, eventHandlers }: any) => (
        <div
            data-testid={'photo-cluster-marker'}
            data-lat={position[0]}
            data-lon={position[1]}
            onClick={eventHandlers?.click}
        />
    )
}))

jest.mock('leaflet', () => ({
    DivIcon: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('@/config/env', () => ({
    IMG_HOST: 'https://img.example.com'
}))

import { MarkerPhotoCluster } from './MarkerPhotoCluster'

const mockMarker = {
    lat: 51.765,
    lon: 55.099,
    preview: '/photos/preview.jpg',
    count: 5,
    type: 'cluster'
}

describe('MarkerPhotoCluster', () => {
    it('renders a marker at the cluster coordinates', () => {
        render(<MarkerPhotoCluster marker={mockMarker as any} />)
        const marker = screen.getByTestId('photo-cluster-marker')
        expect(marker).toHaveAttribute('data-lat', '51.765')
        expect(marker).toHaveAttribute('data-lon', '55.099')
    })

    it('creates a DivIcon with preview image and count', () => {
        const Leaflet = require('leaflet')
        render(<MarkerPhotoCluster marker={mockMarker as any} />)
        expect(Leaflet.DivIcon).toHaveBeenCalledWith(
            expect.objectContaining({
                html: expect.stringContaining('https://img.example.com/photos/preview.jpg')
            })
        )
        expect(Leaflet.DivIcon).toHaveBeenCalledWith(
            expect.objectContaining({
                html: expect.stringContaining('5')
            })
        )
    })

    it('calls onClick with coordinates when marker is clicked', () => {
        const onClick = jest.fn()
        render(<MarkerPhotoCluster marker={mockMarker as any} onClick={onClick} />)
        screen.getByTestId('photo-cluster-marker').click()
        expect(onClick).toHaveBeenCalledWith({ lat: 51.765, lon: 55.099 })
    })
})
