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

jest.mock('@/api/apiWikimediaCommons', () => ({
    APIWikimediaCommons: {
        useGetByBoundsQuery: jest.fn().mockReturnValue({ data: undefined }),
        useLazyGetImageInfoQuery: jest.fn().mockReturnValue([jest.fn().mockResolvedValue({ data: undefined })])
    }
}))

const mockData = {
    query: {
        geosearch: [
            { dist: 10, lat: 51.765, lon: 55.099, pageid: 1, title: 'File:Photo_One.jpg' },
            { dist: 20, lat: 51.8, lon: 55.2, pageid: 2, title: 'File:Photo_Two.jpg' }
        ]
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
            jest.mocked(APIWikimediaCommons.useLazyGetImageInfoQuery).mockReturnValue([
                jest.fn().mockResolvedValue({ data: undefined })
            ])
            const { container } = render(<WikimediaCommons />)
            expect(container.innerHTML).toBe('')
        })

        it('renders nothing when geosearch results are empty', () => {
            jest.mocked(APIWikimediaCommons.useGetByBoundsQuery).mockReturnValue({
                data: { query: { geosearch: [] } }
            })
            jest.mocked(APIWikimediaCommons.useLazyGetImageInfoQuery).mockReturnValue([
                jest.fn().mockResolvedValue({ data: undefined })
            ])
            const { container } = render(<WikimediaCommons />)
            expect(container.innerHTML).toBe('')
        })
    })

    describe('with data', () => {
        beforeEach(() => {
            jest.mocked(APIWikimediaCommons.useGetByBoundsQuery).mockReturnValue({ data: mockData })
            jest.mocked(APIWikimediaCommons.useLazyGetImageInfoQuery).mockReturnValue([
                jest.fn().mockResolvedValue({ data: undefined })
            ])
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

        it('calls onPhotoClick after a successful image info fetch', async () => {
            const onPhotoClick = jest.fn()
            const mockGetImageInfo = jest.fn().mockResolvedValue({
                data: {
                    query: {
                        pages: {
                            '1': {
                                imageinfo: [
                                    {
                                        descriptionurl: 'https://commons.wikimedia.org/wiki/File:Photo_One.jpg',
                                        thumburl: 'https://thumb.url/Photo_One.jpg',
                                        url: 'https://url.com/Photo_One.jpg'
                                    }
                                ],
                                pageid: 1,
                                title: 'File:Photo_One.jpg'
                            }
                        }
                    }
                }
            })
            jest.mocked(APIWikimediaCommons.useLazyGetImageInfoQuery).mockReturnValue([mockGetImageInfo])

            render(<WikimediaCommons onPhotoClick={onPhotoClick} />)
            screen.getAllByTestId('wikimedia-marker')[0].click()

            await screen.findAllByTestId('wikimedia-marker')
            expect(mockGetImageInfo).toHaveBeenCalledWith('File:Photo_One.jpg')
        })
    })
})
