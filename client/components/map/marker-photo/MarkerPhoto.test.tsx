import React from 'react'
import * as Leaflet from 'leaflet'

import { render, screen } from '@testing-library/react'

import { MarkerPhoto } from './MarkerPhoto'

jest.mock('react-leaflet', () => ({
    Marker: ({ position, title, alt, eventHandlers, children }: any) => (
        <div
            data-testid={'photo-marker'}
            data-lat={position[0]}
            data-lon={position[1]}
            data-title={title}
            data-alt={alt}
            onClick={eventHandlers?.click}
        >
            {children}
        </div>
    )
}))

jest.mock('leaflet', () => ({
    Icon: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('@/config/env', () => ({
    IMG_HOST: 'https://img.example.com'
}))

const mockPhoto = {
    id: 'ph1',
    lat: 51.765,
    lon: 55.099,
    preview: '/photos/preview.jpg',
    title: 'Test Photo'
}

describe('MarkerPhoto', () => {
    it('renders a marker at the photo coordinates', () => {
        render(<MarkerPhoto photo={mockPhoto as any} />)
        const marker = screen.getByTestId('photo-marker')
        expect(marker).toHaveAttribute('data-lat', '51.765')
        expect(marker).toHaveAttribute('data-lon', '55.099')
    })

    it('passes title and alt to the Marker', () => {
        render(<MarkerPhoto photo={mockPhoto as any} />)
        const marker = screen.getByTestId('photo-marker')
        expect(marker).toHaveAttribute('data-title', 'Test Photo')
        expect(marker).toHaveAttribute('data-alt', 'Test Photo')
    })

    it('creates an Icon with the full preview URL', () => {
        render(<MarkerPhoto photo={mockPhoto as any} />)
        expect(Leaflet.Icon).toHaveBeenCalledWith(
            expect.objectContaining({
                iconUrl: 'https://img.example.com/photos/preview.jpg'
            })
        )
    })

    it('calls onPhotoClick when marker is clicked', () => {
        const onPhotoClick = jest.fn()
        render(
            <MarkerPhoto
                photo={mockPhoto as any}
                onPhotoClick={onPhotoClick}
            />
        )
        screen.getByTestId('photo-marker').click()
        expect(onPhotoClick).toHaveBeenCalledWith([])
    })
})
