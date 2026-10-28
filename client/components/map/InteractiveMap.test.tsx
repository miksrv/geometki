import React from 'react'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { InteractiveMap } from './InteractiveMap'

jest.mock('react-leaflet', () => ({
    MapContainer: ({ children, _center, zoom, _style, _ref }: any) => (
        <div
            data-testid={'map-container'}
            data-zoom={zoom}
        >
            {children}
        </div>
    ),
    TileLayer: ({ attribution, _url }: any) => (
        <div
            data-testid={'tile-layer'}
            data-attribution={attribution}
        />
    ),
    useMap: jest.fn().mockReturnValue({
        fitBounds: jest.fn(),
        invalidateSize: jest.fn()
    }),
    useMapEvents: jest.fn().mockReturnValue({
        closePopup: jest.fn(),
        getBounds: jest.fn().mockReturnValue({}),
        getZoom: jest.fn().mockReturnValue(12)
    })
}))

jest.mock('leaflet', () => ({
    Icon: jest.fn().mockImplementation(() => ({})),
    DivIcon: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('leaflet/dist/leaflet.css', () => ({}))

jest.mock('simple-react-ui-kit', () => ({
    Button: ({ icon, onClick, mode, _loading, _link, _noIndex }: any) => (
        <button
            data-icon={icon}
            data-mode={mode}
            onClick={onClick}
        />
    ),
    Spinner: () => <div data-testid={'spinner'} />,
    cn: (...args: any[]) => args.filter(Boolean).join(' ')
}))

jest.mock('next/dist/client/router', () => ({
    useRouter: () => ({
        replace: jest.fn().mockResolvedValue(true)
    })
}))

jest.mock('lodash-es/isEqual', () => jest.fn().mockReturnValue(false))

jest.mock('@/config/constants', () => ({
    LOCAL_STORAGE: {
        MAP_CENTER: 'mapCenter',
        MAP_SETTINGS: 'mapSettings',
        LOCALE: 'locale',
        THEME: 'theme',
        RETURN_PATH: 'returnPath'
    }
}))

const mockUserLocation = {
    loading: false,
    location: undefined as { lat: number; lon: number } | undefined,
    refresh: jest.fn(),
    request: jest.fn()
}

jest.mock('@/hooks/useUserLocation', () => ({
    __esModule: true,
    default: () => mockUserLocation
}))

jest.mock('./category-control', () => ({
    CategoryControl: () => <div data-testid={'category-control'} />
}))

jest.mock('./context-menu', () => ({
    ContextMenu: () => <div data-testid={'context-menu'} />
}))

jest.mock('./coordinates-control', () => ({
    CoordinatesControl: () => <div data-testid={'coordinates-control'} />
}))

jest.mock('./hillshade-layer', () => ({
    DEFAULT_HILLSHADE_OPACITY: 0.6,
    HillshadeLayer: () => null
}))

jest.mock('./wayback', () => ({
    Wayback: () => <div data-testid={'wayback'} />
}))

jest.mock('./historical-photos', () => ({
    HistoricalPhotos: () => <div data-testid={'historical-photos'} />
}))

jest.mock('./layer-switcher-control', () => ({
    LayerSwitcherControl: () => <div data-testid={'layer-switcher-control'} />
}))

jest.mock('./MapEvents', () => ({
    MapEvents: () => <div data-testid={'map-events'} />
}))

jest.mock('./marker-photo', () => ({
    MarkerPhoto: ({ index, onPhotoClick }: { index?: number; onPhotoClick?: (index?: number) => void }) => (
        <div
            data-testid={'marker-photo'}
            onClick={() => onPhotoClick?.(index)}
        />
    )
}))

jest.mock('./marker-photo-cluster', () => ({
    MarkerPhotoCluster: () => <div data-testid={'marker-photo-cluster'} />
}))

jest.mock('./marker-point', () => ({
    MarkerPoint: () => <div data-testid={'marker-point'} />
}))

jest.mock('./marker-point-cluster', () => ({
    MarkerPointCluster: () => <div data-testid={'marker-point-cluster'} />
}))

jest.mock('./marker-user', () => ({
    MarkerUser: () => <div data-testid={'marker-user'} />
}))

jest.mock('./place-mark', () => ({
    PlaceMark: () => <div data-testid={'place-mark'} />
}))

jest.mock('./hex-layer', () => ({
    HEX_MAX_ZOOM: 11,
    HexLayer: () => <div data-testid={'hex-layer'} />,
    HexLegend: () => <div data-testid={'hex-legend'} />
}))

jest.mock('./osm-candidates', () => ({
    OsmCandidates: () => <div data-testid={'osm-candidates'} />
}))

describe('InteractiveMap', () => {
    describe('rendering', () => {
        it('renders the map container', () => {
            render(<InteractiveMap />)
            expect(screen.getByTestId('map-container')).toBeInTheDocument()
        })

        it('renders the default OSM tile layer', () => {
            render(<InteractiveMap />)
            const tileLayers = screen.getAllByTestId('tile-layer')
            const osm = tileLayers.find((el) => el.getAttribute('data-attribution') === 'Open Street Map')
            expect(osm).toBeInTheDocument()
        })

        it('does not render the OSM candidates layer by default', () => {
            render(<InteractiveMap />)
            expect(screen.queryByTestId('osm-candidates')).not.toBeInTheDocument()
        })

        it('renders the OSM candidates layer when enabled', () => {
            render(<InteractiveMap enableOsmCandidates={true} />)
            expect(screen.getByTestId('osm-candidates')).toBeInTheDocument()
        })

        it('renders a spinner when loading', () => {
            render(<InteractiveMap loading />)
            expect(screen.getByTestId('spinner')).toBeInTheDocument()
        })

        it('does not render CategoryControl by default', () => {
            render(<InteractiveMap />)
            expect(screen.queryByTestId('category-control')).not.toBeInTheDocument()
        })

        it('renders CategoryControl when enableCategoryControl is true', () => {
            render(<InteractiveMap enableCategoryControl />)
            expect(screen.getByTestId('category-control')).toBeInTheDocument()
        })

        it('does not render LayerSwitcherControl by default', () => {
            render(<InteractiveMap />)
            expect(screen.queryByTestId('layer-switcher-control')).not.toBeInTheDocument()
        })

        it('renders LayerSwitcherControl when enableLayersSwitcher is true', () => {
            render(<InteractiveMap enableLayersSwitcher />)
            expect(screen.getByTestId('layer-switcher-control')).toBeInTheDocument()
        })

        it('does not render ContextMenu by default', () => {
            render(<InteractiveMap />)
            expect(screen.queryByTestId('context-menu')).not.toBeInTheDocument()
        })

        it('renders ContextMenu when enableContextMenu is true', () => {
            render(<InteractiveMap enableContextMenu />)
            expect(screen.getByTestId('context-menu')).toBeInTheDocument()
        })
    })

    describe('control buttons', () => {
        it('renders the add place button when onClickCreatePlace is provided', () => {
            render(<InteractiveMap onClickCreatePlace={jest.fn()} />)
            const btn = screen.getAllByRole('button').find((b) => b.getAttribute('data-icon') === 'PlusCircle')
            expect(btn).toBeInTheDocument()
        })

        it('calls onClickCreatePlace when add place button is clicked', () => {
            const onClickCreatePlace = jest.fn()
            render(<InteractiveMap onClickCreatePlace={onClickCreatePlace} />)
            const btn = screen.getAllByRole('button').find((b) => b.getAttribute('data-icon') === 'PlusCircle')!
            fireEvent.click(btn)
            expect(onClickCreatePlace).toHaveBeenCalledTimes(1)
        })

        it('renders the fullscreen button when enableFullScreen is true', () => {
            render(<InteractiveMap enableFullScreen />)
            const btn = screen
                .getAllByRole('button')
                .find(
                    (b) =>
                        b.getAttribute('data-icon') === 'FullscreenIn' ||
                        b.getAttribute('data-icon') === 'FullscreenOut'
                )
            expect(btn).toBeInTheDocument()
        })

        it('shows the imagery archive in place of the base map while its button is on', () => {
            render(<InteractiveMap enableWayback />)
            const button = () => screen.getAllByRole('button').find((b) => b.getAttribute('data-icon') === 'Time')!

            expect(screen.getByTestId('tile-layer')).toBeInTheDocument()
            expect(screen.queryByTestId('wayback')).not.toBeInTheDocument()

            fireEvent.click(button())
            expect(screen.getByTestId('wayback')).toBeInTheDocument()
            expect(screen.queryByTestId('tile-layer')).not.toBeInTheDocument()

            fireEvent.click(button())
            expect(screen.queryByTestId('wayback')).not.toBeInTheDocument()
        })

        it('has no imagery archive button by default', () => {
            render(<InteractiveMap />)
            expect(screen.queryAllByRole('button').some((b) => b.getAttribute('data-icon') === 'Time')).toBe(false)
        })

        it('has no user position button by default', () => {
            render(<InteractiveMap />)
            expect(screen.queryAllByRole('button').some((b) => b.getAttribute('data-icon') === 'Position')).toBe(false)
        })

        it('renders the user position button before the location is known', () => {
            mockUserLocation.location = undefined
            render(<InteractiveMap enableUserLocation={true} />)
            const btn = screen.getAllByRole('button').find((b) => b.getAttribute('data-icon') === 'Position')
            expect(btn).toBeInTheDocument()
        })

        it('asks for the location only on the user position button click', async () => {
            mockUserLocation.refresh.mockClear()
            mockUserLocation.request.mockClear().mockResolvedValue({ lat: 51.765, lon: 55.099 })
            render(<InteractiveMap enableUserLocation={true} />)
            expect(mockUserLocation.request).not.toHaveBeenCalled()
            expect(mockUserLocation.refresh).toHaveBeenCalledTimes(1)

            const btn = screen.getAllByRole('button').find((b) => b.getAttribute('data-icon') === 'Position')
            fireEvent.click(btn!)

            await waitFor(() => expect(mockUserLocation.request).toHaveBeenCalledTimes(1))
        })
    })

    describe('markers', () => {
        it('renders MarkerPoint for each place', () => {
            const places = [
                { id: 'p1', lat: 51.765, lon: 55.099, type: 'place', category: 'abandoned', count: 1 },
                { id: 'p2', lat: 51.8, lon: 55.2, type: 'place', category: 'landscape', count: 1 }
            ]
            render(<InteractiveMap places={places as any} />)
            expect(screen.getAllByTestId('marker-point')).toHaveLength(2)
        })

        it('renders MarkerPointCluster for cluster type places', () => {
            const places = [{ id: 'c1', lat: 51.765, lon: 55.099, type: 'cluster', count: 5 }]
            render(<InteractiveMap places={places as any} />)
            expect(screen.getByTestId('marker-point-cluster')).toBeInTheDocument()
        })

        it('renders MarkerUser when the user location is known', () => {
            mockUserLocation.location = { lat: 51.765, lon: 55.099 }
            render(<InteractiveMap enableUserLocation={true} />)
            expect(screen.getByTestId('marker-user')).toBeInTheDocument()
            mockUserLocation.location = undefined
        })

        it('renders MarkerPhoto for each photo', () => {
            const photos = [
                { id: 'ph1', lat: 51.765, lon: 55.099, type: 'photo', preview: '/p1.jpg', count: 1 },
                { id: 'ph2', lat: 51.8, lon: 55.2, type: 'photo', preview: '/p2.jpg', count: 1 }
            ]
            render(<InteractiveMap photos={photos as any} />)
            expect(screen.getAllByTestId('marker-photo')).toHaveLength(2)
        })

        it('passes only single photos to onPhotoClick, without the clusters', () => {
            const onPhotoClick = jest.fn()
            const photos = [
                { lat: 51.7, lon: 55.0, type: 'cluster', preview: '/c.jpg', count: 5 },
                { full: '/f1.jpg', lat: 51.765, lon: 55.099, preview: '/p1.jpg' },
                { lat: 51.9, lon: 55.3, type: 'cluster', preview: '/c2.jpg', count: 3 },
                { full: '/f2.jpg', lat: 51.8, lon: 55.2, preview: '/p2.jpg' }
            ]
            render(
                <InteractiveMap
                    photos={photos as any}
                    onPhotoClick={onPhotoClick}
                />
            )
            screen.getAllByTestId('marker-photo')[1].click()

            expect(onPhotoClick).toHaveBeenCalledWith([photos[1], photos[3]], 1)
        })
    })

    describe('hexes', () => {
        const places = [{ id: 'p1', lat: 51.765, lon: 55.099, type: 'place', category: 'abandoned', count: 1 }]

        it('replaces the place markers with the hex layer when zoomed out', () => {
            render(
                <InteractiveMap
                    enableHexes
                    zoom={8}
                    places={places as any}
                />
            )
            expect(screen.getByTestId('hex-layer')).toBeInTheDocument()
            expect(screen.getByTestId('hex-legend')).toBeInTheDocument()
            expect(screen.queryByTestId('marker-point')).not.toBeInTheDocument()
        })

        it('shows the place markers and no hex layer when zoomed in', () => {
            render(
                <InteractiveMap
                    enableHexes
                    zoom={12}
                    places={places as any}
                />
            )
            expect(screen.queryByTestId('hex-layer')).not.toBeInTheDocument()
            expect(screen.queryByTestId('hex-legend')).not.toBeInTheDocument()
            expect(screen.getByTestId('marker-point')).toBeInTheDocument()
        })
    })
})
