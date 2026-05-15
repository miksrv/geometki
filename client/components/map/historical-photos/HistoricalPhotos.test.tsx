import React from 'react'
import * as ReactLeaflet from 'react-leaflet'

import { render, screen } from '@testing-library/react'

import { APIPastvu } from '@/api/apiPastvu'

import { HistoricalPhotos } from './HistoricalPhotos'

const mockBounds = {
    getEast: () => 37.96,
    getNorth: () => 55.92,
    getSouth: () => 55.57,
    getWest: () => 37.29
}

jest.mock('react-leaflet', () => ({
    Marker: ({
        position,
        title,
        eventHandlers
    }: {
        eventHandlers?: { click?: () => void }
        position: [number, number]
        title?: string
    }) => (
        <div
            data-testid={'historical-marker'}
            data-lat={position[0]}
            data-lon={position[1]}
            aria-label={title}
            onClick={eventHandlers?.click}
        />
    ),
    useMapEvents: jest.fn().mockImplementation(() => ({
        getBounds: () => mockBounds,
        getZoom: () => 12,
        setView: jest.fn()
    }))
}))

jest.mock('leaflet', () => ({
    Icon: jest.fn().mockImplementation(() => ({})),
    divIcon: jest.fn().mockReturnValue({})
}))

jest.mock('@/api/apiPastvu', () => ({
    APIPastvu: {
        useGetByBoundsQuery: jest.fn().mockReturnValue({ data: undefined })
    }
}))

const mockData = {
    result: {
        clusters: [],
        photos: [
            { cid: 1, file: 'photo1.jpg', geo: [51.765, 55.099], title: 'Old Photo 1', year: 1900 },
            { cid: 2, file: 'photo2.jpg', geo: [51.8, 55.2], title: 'Old Photo 2', year: 1920 }
        ]
    }
}

describe('HistoricalPhotos', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.mocked(ReactLeaflet.useMapEvents).mockImplementation(() => ({
            getBounds: () => mockBounds,
            getZoom: () => 12,
            setView: jest.fn()
        }))
    })

    describe('no data', () => {
        it('renders nothing when query has no data', () => {
            jest.mocked(APIPastvu.useGetByBoundsQuery).mockReturnValue({ data: undefined })
            const { container } = render(<HistoricalPhotos />)
            expect(container.innerHTML).toBe('')
        })

        it('renders nothing when photos and clusters are empty', () => {
            jest.mocked(APIPastvu.useGetByBoundsQuery).mockReturnValue({
                data: { result: { clusters: [], photos: [] } }
            })
            const { container } = render(<HistoricalPhotos />)
            expect(container.innerHTML).toBe('')
        })
    })

    describe('with photos', () => {
        beforeEach(() => {
            jest.mocked(APIPastvu.useGetByBoundsQuery).mockReturnValue({ data: mockData })
        })

        it('renders a Marker for each photo', () => {
            render(<HistoricalPhotos />)
            expect(screen.getAllByTestId('historical-marker')).toHaveLength(2)
        })

        it('passes title to markers', () => {
            render(<HistoricalPhotos />)
            expect(screen.getByLabelText('Old Photo 1')).toBeInTheDocument()
        })

        it('calls onPhotoClick when a marker is clicked', () => {
            const onPhotoClick = jest.fn()
            render(<HistoricalPhotos onPhotoClick={onPhotoClick} />)
            screen.getAllByTestId('historical-marker')[0].click()
            expect(onPhotoClick).toHaveBeenCalledWith(
                expect.arrayContaining([expect.objectContaining({ title: expect.stringContaining('Old Photo 1') })]),
                0
            )
        })
    })
})
