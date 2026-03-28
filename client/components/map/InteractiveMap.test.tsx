import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

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
    Spinner: () => <div data-testid={'spinner'} />
}))

jest.mock('next/dist/client/router', () => ({
    useRouter: () => ({
        replace: jest.fn().mockResolvedValue(true)
    })
}))

jest.mock('@/hooks/useLocalStorage', () => jest.fn().mockReturnValue([undefined, jest.fn()]))

jest.mock('lodash-es/isEqual', () => jest.fn().mockReturnValue(false))

jest.mock('@/config/constants', () => ({
    LOCAL_STORAGE: {
        MAP_CENTER: 'mapCenter',
        LOCALE: 'locale',
        THEME: 'theme',
        RETURN_PATH: 'returnPath',
        LOCATION: 'location'
    }
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

jest.mock('./heatmap-layer', () => ({
    HeatmapLayer: () => <div data-testid={'heatmap-layer'} />
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
    MarkerPhoto: () => <div data-testid={'marker-photo'} />
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

        it('renders the user position button when userLatLon is provided', () => {
            render(<InteractiveMap userLatLon={{ lat: 51.765, lon: 55.099 }} />)
            const btn = screen.getAllByRole('button').find((b) => b.getAttribute('data-icon') === 'Position')
            expect(btn).toBeInTheDocument()
        })
    })

    describe('markers', () => {
        it('renders MarkerPoint for each place', () => {
            const places = [
                { id: 'p1', lat: 51.765, lon: 55.099, type: 'place', category: 'abandoned', count: 1 },
                { id: 'p2', lat: 51.8, lon: 55.2, type: 'place', category: 'nature', count: 1 }
            ]
            render(<InteractiveMap places={places as any} />)
            expect(screen.getAllByTestId('marker-point')).toHaveLength(2)
        })

        it('renders MarkerPointCluster for cluster type places', () => {
            const places = [{ id: 'c1', lat: 51.765, lon: 55.099, type: 'cluster', count: 5 }]
            render(<InteractiveMap places={places as any} />)
            expect(screen.getByTestId('marker-point-cluster')).toBeInTheDocument()
        })

        it('renders MarkerUser when userLatLon is provided', () => {
            render(<InteractiveMap userLatLon={{ lat: 51.765, lon: 55.099 }} />)
            expect(screen.getByTestId('marker-user')).toBeInTheDocument()
        })

        it('renders MarkerPhoto for each photo', () => {
            const photos = [
                { id: 'ph1', lat: 51.765, lon: 55.099, type: 'photo', preview: '/p1.jpg', count: 1 },
                { id: 'ph2', lat: 51.8, lon: 55.2, type: 'photo', preview: '/p2.jpg', count: 1 }
            ]
            render(<InteractiveMap photos={photos as any} />)
            expect(screen.getAllByTestId('marker-photo')).toHaveLength(2)
        })
    })
})
