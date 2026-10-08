import React from 'react'
import * as ReactLeaflet from 'react-leaflet'

import { render, screen } from '@testing-library/react'

import { APIWikimediaCommons } from '@/api/apiWikimediaCommons'

import { WikimediaCommons } from './WikimediaCommons'

const mockBounds = {
    getEast: () => 37.96,
    getNorth: () => 55.92,
    getSouth: () => 55.57,
    getWest: () => 37.29
}

jest.mock('react-leaflet', () => ({
    Marker: ({
        position,
        eventHandlers,
        children
    }: {
        children?: React.ReactNode
        eventHandlers?: { click?: () => void }
        position: [number, number]
    }) => (
        <div
            data-testid={'wikimedia-marker'}
            data-lat={position[0]}
            data-lon={position[1]}
            onClick={eventHandlers?.click}
        >
            {children}
        </div>
    ),
    Tooltip: ({ children }: { children?: React.ReactNode }) => <span data-testid={'leaflet-tooltip'}>{children}</span>,
    useMapEvents: jest.fn().mockImplementation(() => ({
        getBounds: () => mockBounds,
        getZoom: () => 12,
        setView: jest.fn()
    }))
}))

jest.mock('leaflet', () => ({
    divIcon: jest.fn().mockReturnValue({})
}))

jest.mock('../linked-photos', () => ({
    linkedPhotoStyles: { linked: 'linked' },
    linkedPlacesTitle: jest.fn(),
    useLinkedExternalPhotos: jest.fn().mockReturnValue(new Map())
}))

jest.mock('@/api/apiWikimediaCommons', () => ({
    APIWikimediaCommons: {
        useGetByBoundsQuery: jest.fn().mockReturnValue({ data: undefined })
    }
}))

const mockData = {
    query: {
        pages: {
            '1': {
                coordinates: [{ lat: 51.765, lon: 55.099 }],
                imageinfo: [{ url: 'https://url.com/Photo_One.jpg' }],
                index: 0,
                pageid: 1,
                title: 'File:Photo_One.jpg'
            },
            '2': {
                coordinates: [{ lat: 51.8, lon: 55.2 }],
                imageinfo: [{ url: 'https://url.com/Photo_Two.jpg' }],
                index: 1,
                pageid: 2,
                title: 'File:Photo_Two.jpg'
            }
        }
    }
}

describe('WikimediaCommons', () => {
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
            jest.mocked(APIWikimediaCommons.useGetByBoundsQuery).mockReturnValue({ data: undefined })
            const { container } = render(<WikimediaCommons />)
            expect(container.innerHTML).toBe('')
        })

        it('renders nothing when geosearch results are empty', () => {
            jest.mocked(APIWikimediaCommons.useGetByBoundsQuery).mockReturnValue({
                data: { query: { pages: {} } }
            })
            const { container } = render(<WikimediaCommons />)
            expect(container.innerHTML).toBe('')
        })
    })

    describe('with data', () => {
        beforeEach(() => {
            jest.mocked(APIWikimediaCommons.useGetByBoundsQuery).mockReturnValue({ data: mockData })
        })

        it('renders a Marker for each geosearch item', () => {
            render(<WikimediaCommons />)
            expect(screen.getAllByTestId('wikimedia-marker')).toHaveLength(2)
        })

        it('renders leaflet tooltips for each marker', () => {
            render(<WikimediaCommons />)
            expect(screen.getAllByTestId('leaflet-tooltip')).toHaveLength(2)
        })

        it('shows cleaned title in tooltip', () => {
            render(<WikimediaCommons />)
            expect(screen.getByText('Photo One.jpg')).toBeInTheDocument()
        })

        it('passes correct position to markers', () => {
            render(<WikimediaCommons />)
            const markers = screen.getAllByTestId('wikimedia-marker')
            expect(markers[0]).toHaveAttribute('data-lat', '51.765')
        })

        it('passes every photo of the area to onPhotoClick, starting from the clicked one', () => {
            const onPhotoClick = jest.fn()

            render(<WikimediaCommons onPhotoClick={onPhotoClick} />)
            screen.getAllByTestId('wikimedia-marker')[1].click()

            expect(onPhotoClick).toHaveBeenCalledTimes(1)
            const [photos, index] = onPhotoClick.mock.calls[0]
            expect(photos.map((photo: { full: string }) => photo.full)).toStrictEqual([
                'https://url.com/Photo_One.jpg',
                'https://url.com/Photo_Two.jpg'
            ])
            expect(index).toBe(1)
        })
    })
})
