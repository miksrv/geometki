import React from 'react'

import { render, screen } from '@testing-library/react'

import { APIPastvu } from '@/api/apiPastvu'

import { HistoricalPhotos } from './HistoricalPhotos'

jest.mock('react-leaflet', () => ({
    Marker: ({ position, title, _alt, eventHandlers }: any) => (
        <div
            data-testid={'historical-marker'}
            data-lat={position[0]}
            data-lon={position[1]}
            aria-label={title}
            onClick={eventHandlers?.click}
        />
    )
}))

jest.mock('leaflet', () => ({
    Icon: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('@/api/apiPastvu', () => ({
    APIPastvu: {
        useNearestGetPhotosQuery: jest.fn().mockReturnValue({ data: undefined })
    }
}))

const mockPhotosData = {
    result: {
        photos: [
            { cid: 1, geo: [51.765, 55.099], file: 'photo1.jpg', title: 'Old Photo 1', year: 1900 },
            { cid: 2, geo: [51.8, 55.2], file: 'photo2.jpg', title: 'Old Photo 2', year: 1920 }
        ]
    }
}

describe('HistoricalPhotos', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('no data / skipped', () => {
        it('renders nothing when no position is provided', () => {
            const { container } = render(<HistoricalPhotos />)
            expect(container.innerHTML).toBe('')
        })

        it('renders nothing when data has no photos', () => {
            jest.mocked(APIPastvu.useNearestGetPhotosQuery).mockReturnValue({
                data: { result: { photos: [] } }
            })

            const { container } = render(<HistoricalPhotos position={{ lat: 51.765, lon: 55.099, zoom: 12 }} />)
            expect(container.innerHTML).toBe('')
        })
    })

    describe('with photos', () => {
        beforeEach(() => {
            jest.mocked(APIPastvu.useNearestGetPhotosQuery).mockReturnValue({ data: mockPhotosData })
        })

        it('renders a Marker for each photo', () => {
            render(<HistoricalPhotos position={{ lat: 51.765, lon: 55.099, zoom: 12 }} />)
            expect(screen.getAllByTestId('historical-marker')).toHaveLength(2)
        })

        it('passes title to markers', () => {
            render(<HistoricalPhotos position={{ lat: 51.765, lon: 55.099, zoom: 12 }} />)
            expect(screen.getByLabelText('Old Photo 1')).toBeInTheDocument()
        })

        it('calls onPhotoClick when a marker is clicked', () => {
            const onPhotoClick = jest.fn()
            render(
                <HistoricalPhotos
                    position={{ lat: 51.765, lon: 55.099, zoom: 12 }}
                    onPhotoClick={onPhotoClick}
                />
            )
            screen.getAllByTestId('historical-marker')[0].click()
            expect(onPhotoClick).toHaveBeenCalledWith(
                expect.arrayContaining([expect.objectContaining({ title: expect.stringContaining('Old Photo 1') })]),
                0
            )
        })
    })
})
