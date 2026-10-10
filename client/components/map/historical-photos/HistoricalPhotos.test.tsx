import React from 'react'
import * as ReactLeaflet from 'react-leaflet'

import { render, screen } from '@testing-library/react'

import { APIPastvu } from '@/api/apiPastvu'

import { HistoricalPhotos } from './HistoricalPhotos'

// A city district, about 7 km across: small enough for the geosearch of Wikipedia and Commons
const mockBounds = {
    getEast: () => 37.65,
    getNorth: () => 55.76,
    getSouth: () => 55.7,
    getWest: () => 37.55
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

jest.mock('../linked-photos', () => ({
    linkedPhotoStyles: { linked: 'linked' },
    linkedPlacesTitle: jest.fn(),
    useLinkedExternalPhotos: jest.fn().mockReturnValue(new Map())
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

// Two photos a few meters apart and one far away
const closePhotos = {
    result: {
        clusters: [],
        photos: [
            { cid: 1, file: 'photo1.jpg', geo: [51.765, 55.099], title: 'Old Photo 1', year: 1900 },
            { cid: 2, file: 'photo2.jpg', geo: [51.76501, 55.09901], title: 'Old Photo 2', year: 1910 },
            { cid: 3, file: 'photo3.jpg', geo: [51.8, 55.2], title: 'Old Photo 3', year: 1920 }
        ]
    }
}

// 1 degree = 100 000 px: the two close photos share a 64 px cell
const mockCloseMap = (maxZoom: number, setView = jest.fn()) =>
    jest.mocked(ReactLeaflet.useMapEvents).mockImplementation(() => ({
        getBounds: () => mockBounds,
        getMaxZoom: () => maxZoom,
        getZoom: () => 17,
        project: ([lat, lon]: [number, number]) => ({ x: lon * 100000, y: lat * 100000 }),
        setView
    }))

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

        it('draws every photo separately below zoom 17: PastVu has clustered them already', () => {
            jest.mocked(APIPastvu.useGetByBoundsQuery).mockReturnValue({ data: closePhotos })
            render(<HistoricalPhotos />)
            expect(screen.getAllByTestId('historical-marker')).toHaveLength(3)
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

    describe('from zoom 17', () => {
        beforeEach(() => {
            jest.mocked(APIPastvu.useGetByBoundsQuery).mockReturnValue({ data: closePhotos })
        })

        it('groups the photos that share a screen cell into one marker', () => {
            mockCloseMap(19)
            render(<HistoricalPhotos />)

            expect(screen.getAllByTestId('historical-marker')).toHaveLength(2)
            expect(screen.getByLabelText('Old Photo 3')).toBeInTheDocument()
        })

        it('zooms in on a group while the map can zoom in', () => {
            const setView = jest.fn()
            mockCloseMap(19, setView)
            render(<HistoricalPhotos />)

            screen.getAllByTestId('historical-marker')[0].click()
            expect(setView).toHaveBeenCalledWith([51.765, 55.099], 18)
        })

        it('opens the photos of the group at the maximum zoom', () => {
            const onPhotoClick = jest.fn()
            mockCloseMap(17)
            render(<HistoricalPhotos onPhotoClick={onPhotoClick} />)

            screen.getAllByTestId('historical-marker')[0].click()
            expect(onPhotoClick).toHaveBeenCalledWith(
                [
                    expect.objectContaining({ title: 'Old Photo 1 (1900)' }),
                    expect.objectContaining({ title: 'Old Photo 2 (1910)' })
                ],
                0
            )
        })
    })
})
