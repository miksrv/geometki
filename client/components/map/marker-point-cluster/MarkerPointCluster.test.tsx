import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('react-leaflet', () => ({
    Marker: ({ position, eventHandlers }: any) => (
        <div
            data-testid={'point-cluster-marker'}
            data-lat={position[0]}
            data-lon={position[1]}
            onClick={eventHandlers?.click}
        />
    )
}))

jest.mock('leaflet', () => ({
    DivIcon: jest.fn().mockImplementation(() => ({}))
}))

import { MarkerPointCluster } from './MarkerPointCluster'

const mockMarker = {
    lat: 51.765,
    lon: 55.099,
    count: 12,
    type: 'cluster'
}

describe('MarkerPointCluster', () => {
    it('renders a marker at the cluster coordinates', () => {
        render(<MarkerPointCluster marker={mockMarker as any} />)
        const marker = screen.getByTestId('point-cluster-marker')
        expect(marker).toHaveAttribute('data-lat', '51.765')
        expect(marker).toHaveAttribute('data-lon', '55.099')
    })

    it('creates a DivIcon containing the count', () => {
        const Leaflet = require('leaflet')
        render(<MarkerPointCluster marker={mockMarker as any} />)
        expect(Leaflet.DivIcon).toHaveBeenCalledWith(
            expect.objectContaining({
                html: expect.stringContaining('12')
            })
        )
    })

    it('calls onClick with coordinates when marker is clicked', () => {
        const onClick = jest.fn()
        render(<MarkerPointCluster marker={mockMarker as any} onClick={onClick} />)
        screen.getByTestId('point-cluster-marker').click()
        expect(onClick).toHaveBeenCalledWith({ lat: 51.765, lon: 55.099 })
    })
})
