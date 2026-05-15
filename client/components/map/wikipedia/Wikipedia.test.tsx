import React from 'react'
import * as ReactLeaflet from 'react-leaflet'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { APIWikipedia } from '@/api/apiWikipedia'

import { Wikipedia } from './Wikipedia'

const mockBounds = {
    getEast: () => 37.96,
    getNorth: () => 55.92,
    getSouth: () => 55.57,
    getWest: () => 37.29
}

const mockOpenPopup = jest.fn()

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
            data-testid={'wikipedia-marker'}
            data-lat={position[0]}
            data-lon={position[1]}
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    eventHandlers?.click?.()
                }
            }}
        >
            {children}
        </div>
    ),
    Popup: ({ children, eventHandlers }: { children?: React.ReactNode; eventHandlers?: { remove?: () => void } }) => (
        <div data-testid={'leaflet-popup'}>
            {children}
            <button
                data-testid={'leaflet-popup-close'}
                onClick={eventHandlers?.remove}
            />
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
    divIcon: jest.fn().mockReturnValue({}),
    Marker: jest.fn().mockImplementation(() => ({ openPopup: mockOpenPopup }))
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({ i18n: { language: 'ru' } })
}))

jest.mock('simple-react-ui-kit', () => ({
    Skeleton: ({ className }: { className?: string }) => (
        <div
            data-testid={'skeleton'}
            className={className}
        />
    )
}))

jest.mock('@/api/apiWikipedia', () => ({
    APIWikipedia: {
        useGetByBoundsQuery: jest.fn().mockReturnValue({ data: undefined }),
        useLazyGetExtractQuery: jest.fn().mockReturnValue([jest.fn().mockResolvedValue({ data: undefined })])
    }
}))

const mockData = {
    query: {
        geosearch: [
            { dist: 10, lat: 51.765, lon: 55.099, pageid: 1, title: 'Orenburg' },
            { dist: 20, lat: 51.8, lon: 55.2, pageid: 2, title: 'Orenburg Oblast' }
        ]
    }
}

describe('Wikipedia', () => {
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
            jest.mocked(APIWikipedia.useGetByBoundsQuery).mockReturnValue({ data: undefined })
            jest.mocked(APIWikipedia.useLazyGetExtractQuery).mockReturnValue([
                jest.fn().mockResolvedValue({ data: undefined })
            ])
            const { container } = render(<Wikipedia />)
            expect(container.innerHTML).toBe('')
        })

        it('renders nothing when geosearch results are empty', () => {
            jest.mocked(APIWikipedia.useGetByBoundsQuery).mockReturnValue({
                data: { query: { geosearch: [] } }
            })
            jest.mocked(APIWikipedia.useLazyGetExtractQuery).mockReturnValue([
                jest.fn().mockResolvedValue({ data: undefined })
            ])
            const { container } = render(<Wikipedia />)
            expect(container.innerHTML).toBe('')
        })
    })

    describe('with data', () => {
        beforeEach(() => {
            jest.mocked(APIWikipedia.useGetByBoundsQuery).mockReturnValue({ data: mockData })
            jest.mocked(APIWikipedia.useLazyGetExtractQuery).mockReturnValue([
                jest.fn().mockResolvedValue({ data: undefined })
            ])
        })

        it('renders a Marker for each geosearch item', () => {
            render(<Wikipedia />)
            expect(screen.getAllByTestId('wikipedia-marker')).toHaveLength(2)
        })

        it('passes title to Tooltip', () => {
            render(<Wikipedia />)
            expect(screen.getByText('Orenburg')).toBeInTheDocument()
        })

        it('passes correct position to markers', () => {
            render(<Wikipedia />)
            const markers = screen.getAllByTestId('wikipedia-marker')
            expect(markers[0]).toHaveAttribute('data-lat', '51.765')
        })

        it('calls getExtract on marker click', async () => {
            const mockGetExtract = jest.fn().mockResolvedValue({ data: undefined })
            jest.mocked(APIWikipedia.useLazyGetExtractQuery).mockReturnValue([mockGetExtract])

            render(<Wikipedia />)
            screen.getAllByTestId('wikipedia-marker')[0].click()

            await screen.findByTestId('leaflet-popup')
            expect(mockGetExtract).toHaveBeenCalledWith({ locale: 'ru', pageid: 1 })
        })

        it('shows skeleton inside Popup immediately on click', async () => {
            let resolveExtract!: (value: { data: undefined }) => void
            const mockGetExtract = jest.fn().mockReturnValue(
                new Promise<{ data: undefined }>((resolve) => {
                    resolveExtract = resolve
                })
            )
            jest.mocked(APIWikipedia.useLazyGetExtractQuery).mockReturnValue([mockGetExtract])

            render(<Wikipedia />)
            screen.getAllByTestId('wikipedia-marker')[0].click()

            const popup = await screen.findByTestId('leaflet-popup')
            expect(popup).toBeInTheDocument()
            expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0)

            resolveExtract({ data: undefined })
        })

        it('shows article data in Popup after click', async () => {
            const mockGetExtract = jest.fn().mockResolvedValue({
                data: {
                    query: {
                        pages: {
                            '1': {
                                extract: 'Orenburg is a city in Russia.',
                                pageid: 1,
                                thumbnail: { height: 200, source: 'https://thumb.url/orenburg.jpg', width: 300 },
                                title: 'Orenburg'
                            }
                        }
                    }
                }
            })
            jest.mocked(APIWikipedia.useLazyGetExtractQuery).mockReturnValue([mockGetExtract])

            render(<Wikipedia />)
            screen.getAllByTestId('wikipedia-marker')[0].click()

            await screen.findByText('Orenburg is a city in Russia.')
            expect(screen.getByRole('heading', { name: 'Orenburg' })).toBeInTheDocument()
        })

        it('closes Popup and resets state on close', async () => {
            render(<Wikipedia />)
            screen.getAllByTestId('wikipedia-marker')[0].click()

            await screen.findByTestId('leaflet-popup')
            fireEvent.click(screen.getByTestId('leaflet-popup-close'))

            await waitFor(() => expect(screen.queryByTestId('leaflet-popup')).not.toBeInTheDocument())
        })
    })
})
