import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as ReactLeaflet from 'react-leaflet'
import { FitBoundsOptions, LatLngBounds, LatLngBoundsExpression, LatLngExpression, Map, MapOptions } from 'leaflet'
import isEqual from 'lodash-es/isEqual'
import { Button, cn, Spinner } from 'simple-react-ui-kit'

import { useRouter } from 'next/dist/client/router'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel, ApiType } from '@/api'
import { LOCAL_STORAGE } from '@/config/constants'
import useLocalStorage from '@/hooks/useLocalStorage'

import { AreaMeasure } from './area-measure'
import { CategoryControl } from './category-control'
import { ContextMenu } from './context-menu'
import { CoordinatesControl } from './coordinates-control'
import { FitBounds } from './fit-bounds'
import { HeatmapLayer } from './heatmap-layer'
import { HistoricalPhotos } from './historical-photos'
import { LayerSwitcherControl } from './layer-switcher-control'
import { MapControlsContext } from './MapControlsContext'
import { MapEvents } from './MapEvents'
import { MarkerPhoto } from './marker-photo'
import { MarkerPhotoCluster } from './marker-photo-cluster'
import { MarkerPin } from './marker-pin'
import { MarkerPoint } from './marker-point'
import { MarkerPointCluster } from './marker-point-cluster'
import { MarkerUser } from './marker-user'
import { OsmCandidates } from './osm-candidates'
import { PlaceMark } from './place-mark'
import { Ruler } from './ruler'
import { MapAdditionalLayersEnum, MapLayersEnum, MapObjectsTypeEnum, MapPositionType, MarkerPinData } from './types'
import { WikimediaCommons } from './wikimedia-commons'
import { Wikipedia } from './wikipedia'

import 'leaflet/dist/leaflet.css'
import styles from './styles.module.sass'

type MapProps = {
    places?: ApiModel.PlaceMark[]
    photos?: ApiModel.PhotoMark[]
    pins?: MarkerPinData[]
    categories?: ApiModel.Categories[]
    layer?: MapLayersEnum
    loading?: boolean
    storeMapPosition?: boolean
    enableCenterPopup?: boolean
    enableFullScreen?: boolean
    /** "Линейка" button: measuring distances on the map */
    enableRuler?: boolean
    enableAreaMeasure?: boolean
    enableCoordsControl?: boolean
    enableCategoryControl?: boolean
    enableLayersSwitcher?: boolean
    enableContextMenu?: boolean
    hideAdditionalLayers?: boolean
    /** Additional layers switched on when the map opens */
    defaultAdditionalLayers?: MapAdditionalLayersEnum[]
    storeMapKey?: string
    fullMapLink?: string
    userLatLon?: ApiType.Coordinates
    onChangeCategories?: (categories?: ApiModel.Categories[]) => void
    onChangeMapType?: (type?: MapObjectsTypeEnum) => void
    onChangeBounds?: (bounds: LatLngBounds, zoom: number) => void
    onPhotoClick?: (photos: ApiModel.PhotoMark[], index?: number) => void
    onClickCreatePlace?: () => void
    controlsSize?: 'small' | 'medium'
    /** Initial viewport that contains all of these bounds (MapContainer `bounds`); overrides center/zoom on mount */
    bounds?: LatLngBoundsExpression
    boundsOptions?: FitBoundsOptions
} & MapOptions

type MeasureTool = 'ruler' | 'area'

// The kit has no icon for an area: a polygon with its corner points, drawn like the kit icons
const AreaIcon: React.FC = () => (
    <svg
        viewBox={'0 0 24 24'}
        aria-hidden={true}
    >
        <path
            fillOpacity={0.3}
            d={'M6.7 7.13 16.99 8.97 15.97 16.8 6.37 14.58Z'}
        />
        <path
            fillRule={'evenodd'}
            d={'M5 5 19 7.5 17.5 19 4.5 16ZM6.7 7.13 16.99 8.97 15.97 16.8 6.37 14.58Z'}
        />
        <circle
            cx={5}
            cy={5}
            r={2.2}
        />
        <circle
            cx={19}
            cy={7.5}
            r={2.2}
        />
        <circle
            cx={17.5}
            cy={19}
            r={2.2}
        />
        <circle
            cx={4.5}
            cy={16}
            r={2.2}
        />
    </svg>
)

const DEFAULT_MAP_ZOOM = 12
const DEFAULT_MAP_CENTER: LatLngExpression = [51.765445, 55.099745]
const DEFAULT_MAP_LAYER = MapLayersEnum.OSM
const DEFAULT_MAP_TYPE = MapObjectsTypeEnum.PLACES

export const InteractiveMap: React.FC<MapProps> = ({
    places,
    photos,
    pins,
    categories,
    // layer,
    loading,
    storeMapPosition,
    enableCenterPopup,
    enableFullScreen,
    enableRuler,
    enableAreaMeasure,
    enableCoordsControl,
    enableCategoryControl,
    enableLayersSwitcher,
    enableContextMenu,
    hideAdditionalLayers,
    defaultAdditionalLayers,
    storeMapKey,
    fullMapLink,
    userLatLon,
    onChangeCategories,
    onChangeMapType,
    onChangeBounds,
    onPhotoClick,
    onClickCreatePlace,
    controlsSize = 'medium',
    ...props
}) => {
    const { t } = useTranslation()
    const router = useRouter()
    const mapRef = useRef<Map>(null)

    const [readyStorage, setReadyStorage] = useState<boolean>(false)
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
    // One measuring tool at a time: both take over the map clicks
    const [activeTool, setActiveTool] = useState<MeasureTool>()
    const [placeMark, setPlaceMark] = useState<ApiType.Coordinates>()
    const [mapPosition, setMapPosition] = useState<MapPositionType>()
    const [mapLayer, setMapLayer] = useState<MapLayersEnum>(DEFAULT_MAP_LAYER)
    const [mapType, setMapType] = useState<MapObjectsTypeEnum>(DEFAULT_MAP_TYPE)
    const [bottomSlot, setBottomSlot] = useState<HTMLDivElement | null>(null)
    const [additionalLayers, setAdditionalLayers] = useState<MapAdditionalLayersEnum[] | undefined>(
        defaultAdditionalLayers
    )

    const [coordinates, setCoordinates] = useLocalStorage<MapPositionType>(storeMapKey || LOCAL_STORAGE.MAP_CENTER)

    const handleUserPosition = () => {
        if (userLatLon?.lat && userLatLon.lon) {
            mapRef.current?.setView([userLatLon.lat, userLatLon.lon], DEFAULT_MAP_ZOOM)
        }
    }

    const controlsContext = useMemo(() => ({ bottomSlot }), [bottomSlot])

    const toggleTool = (tool: MeasureTool) => setActiveTool((prev) => (prev === tool ? undefined : tool))

    const handleChangeBounds = (bounds: LatLngBounds, zoom: number) => {
        const center = bounds.getCenter()
        const currentMapPosition = {
            lat: center.lat,
            lon: center.lng,
            zoom
        }

        if (!isEqual(mapPosition, currentMapPosition)) {
            onChangeBounds?.(bounds, zoom)
            setMapPosition(currentMapPosition)

            if (readyStorage && storeMapPosition) {
                setCoordinates(currentMapPosition)
            }
        }
    }

    const handleSwitchMapType = (type: MapObjectsTypeEnum) => {
        setMapType(type)
        onChangeMapType?.(type)
    }

    const handleSetPlaceMarker = async (coords: ApiType.Coordinates | undefined) => {
        setPlaceMark(coords)

        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href)
            const match = url.hash.match(/\?m=(-?\d+\.\d+),(-?\d+\.\d+)/)
            const param = coords ? `?m=${coords.lat},${coords.lon}` : ''

            url.hash = match ? url.hash.replace(match[0], param) : url.hash + param

            await router.replace(url.toString())
        }
    }

    // Stable reference shared by every cluster marker (place or photo) so memoized
    // markers don't re-render just because the map position state changed.
    const handleClusterClick = useCallback((coords: ApiType.Coordinates) => {
        const zoom = (mapRef.current?.getZoom() ?? 16) + 2
        mapRef.current?.setView([coords.lat, coords.lon], zoom)
    }, [])

    // Stable reference for photo markers: the clicked marker's index is passed back as
    // plain data (not baked into a per-item closure), the current `photos` list comes
    // from the ref-free dependency array.
    const handlePhotoMarkerClick = useCallback(
        (index?: number) => {
            if (typeof index === 'number' && photos) {
                onPhotoClick?.(photos, index)
            }
        },
        [photos, onPhotoClick]
    )

    const handleToggleFullscreen = async () => {
        const mapElement = mapRef?.current?.getContainer()

        if (mapElement?.requestFullscreen) {
            // Full screen mode supported
            if (!document.fullscreenElement) {
                await mapElement.requestFullscreen()
            } else {
                await document.exitFullscreen()
            }
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
        } else if (mapElement.webkitRequestFullscreen) {
            // For Safari on iOS devices
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            const fullscreenElement = document.webkitFullscreenElement || document.webkitCurrentFullScreenElement
            if (!fullscreenElement) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                await mapElement.webkitRequestFullscreen()
            } else {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                await document.webkitExitFullscreen()
            }
        }
    }

    useEffect(() => {
        const url = new URL(window.location.href)
        const match = url.hash.match(/\?m=(-?\d+\.\d+),(-?\d+\.\d+)/)

        if (match && !placeMark) {
            const [, lat, lon] = match
            setPlaceMark({
                lat: Number(lat),
                lon: Number(lon)
            })
        } else if (!match && placeMark) {
            setPlaceMark(undefined)
        }

        if (typeof coordinates !== 'undefined') {
            if (
                !readyStorage &&
                !props.center &&
                storeMapPosition &&
                coordinates.lon &&
                coordinates.lat &&
                coordinates.zoom &&
                mapRef.current?.setView
            ) {
                mapRef.current?.setView([coordinates.lat, coordinates.lon], coordinates.zoom || DEFAULT_MAP_ZOOM)
            }

            setReadyStorage(true)
        }
    }, [props.center, readyStorage, coordinates, placeMark])

    useEffect(() => {
        // With `bounds` the viewport is the fitted bounds, not center/zoom
        if (!props.bounds && (props.center || props.zoom)) {
            mapRef.current?.setView(
                props.center ?? DEFAULT_MAP_CENTER,
                props.zoom ?? mapPosition?.zoom ?? DEFAULT_MAP_ZOOM
            )
        }
    }, [props.center, props.zoom, props.bounds])

    useEffect(() => {
        onChangeMapType?.(mapType)
    }, [])

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement)
        }

        document.addEventListener('fullscreenchange', handleFullscreenChange)

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange)
        }
    }, [])

    return (
        <div className={cn(styles.mapContainer, controlsSize === 'small' && styles.compact)}>
            <ReactLeaflet.MapContainer
                {...props}
                // MapContainer prefers center/zoom over bounds when both are set, so with
                // `bounds` the viewport comes from them alone (see FitBounds below)
                center={props.bounds ? undefined : (props.center ?? DEFAULT_MAP_CENTER)}
                zoom={props.bounds ? undefined : (props.zoom ?? DEFAULT_MAP_ZOOM)}
                minZoom={props.minZoom ?? 6}
                style={{
                    cursor: enableCoordsControl ? 'crosshair' : props.dragging ? 'pointer' : 'default',
                    height: '100%',
                    width: '100%'
                }}
                attributionControl={false}
                ref={mapRef}
            >
                <MapControlsContext.Provider value={controlsContext}>
                    <FitBounds
                        bounds={props.bounds}
                        options={props.boundsOptions}
                    />

                    {additionalLayers?.includes(MapAdditionalLayersEnum.HEATMAP) && <HeatmapLayer />}

                    {additionalLayers?.includes(MapAdditionalLayersEnum.HISTORICAL_PHOTOS) && (
                        <HistoricalPhotos onPhotoClick={onPhotoClick} />
                    )}

                    {additionalLayers?.includes(MapAdditionalLayersEnum.WIKIMEDIA_COMMONS) && (
                        <WikimediaCommons onPhotoClick={onPhotoClick} />
                    )}

                    {additionalLayers?.includes(MapAdditionalLayersEnum.OSM_CANDIDATES) && <OsmCandidates />}

                    {additionalLayers?.includes(MapAdditionalLayersEnum.WIKIPEDIA) && (
                        <Wikipedia onPhotoClick={onPhotoClick} />
                    )}

                    {mapLayer === MapLayersEnum.CARTO_DARK && (
                        <ReactLeaflet.TileLayer
                            attribution='&copy; <a href="https://carto.com">CartoDB</a>'
                            url='https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
                        />
                    )}
                    {mapLayer === MapLayersEnum.CARTO_LIGHT && (
                        <ReactLeaflet.TileLayer
                            attribution='&copy; <a href="https://carto.com">CartoDB</a>'
                            url='https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
                        />
                    )}
                    {mapLayer === MapLayersEnum.ESRI_SAT && (
                        <ReactLeaflet.TileLayer
                            attribution='Tiles &copy; Esri'
                            url='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                            maxZoom={19}
                        />
                    )}
                    {mapLayer === MapLayersEnum.OCM && (
                        <ReactLeaflet.TileLayer
                            attribution='Open Cycle Map'
                            url={`https://tile.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=${process.env.NEXT_PUBLIC_CYCLEMAP_TOKEN}`}
                        />
                    )}
                    {mapLayer === MapLayersEnum.OPEN_TOPO && (
                        <ReactLeaflet.TileLayer
                            attribution='&copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
                            url='https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
                            maxZoom={17}
                        />
                    )}
                    {mapLayer === MapLayersEnum.YANDEX_SAT && (
                        <ReactLeaflet.TileLayer
                            attribution='&copy; Яндекс'
                            url='https://core-sat.maps.yandex.net/tiles?l=sat&x={x}&y={y}&z={z}'
                            maxZoom={19}
                        />
                    )}
                    {mapLayer === MapLayersEnum.MAPBOX && (
                        <ReactLeaflet.TileLayer
                            attribution='&copy; <a href="https://www.mapbox.com">Mapbox</a> '
                            url={`https://api.mapbox.com/styles/v1/miksoft/cli4uhd5b00bp01r6eocm21rq/tiles/256/{z}/{x}/{y}@2x?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`}
                        />
                    )}
                    {mapLayer === MapLayersEnum.OSM && (
                        <ReactLeaflet.TileLayer
                            attribution={'Open Street Map'}
                            url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                        />
                    )}
                    {mapLayer === MapLayersEnum.GOOGLE_MAP && (
                        <ReactLeaflet.TileLayer
                            attribution={'Google Maps'}
                            url={'https://www.google.cn/maps/vt?lyrs=m@189&gl=cn&x={x}&y={y}&z={z}'}
                        />
                    )}
                    {mapLayer === MapLayersEnum.GOOGLE_SAT && (
                        <ReactLeaflet.TileLayer
                            attribution={'Google Maps Satellite'}
                            url={'https://www.google.cn/maps/vt?lyrs=s@189&gl=cn&x={x}&y={y}&z={z}'}
                        />
                    )}
                    {mapLayer === MapLayersEnum.MAPBOX_SAT && (
                        <ReactLeaflet.TileLayer
                            attribution='&copy; <a href="https://www.mapbox.com">Mapbox</a> '
                            url='https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v11/tiles/{z}/{x}/{y}?access_token={accessToken}'
                            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                            // @ts-ignore
                            accessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
                        />
                    )}

                    {placeMark && (
                        <PlaceMark
                            {...placeMark}
                            onClick={() => handleSetPlaceMarker(undefined)}
                        />
                    )}

                    {places?.map((place, i) =>
                        place.type === 'cluster' ? (
                            <MarkerPointCluster
                                key={`markerPointCluster${i}`}
                                marker={place}
                                onClick={handleClusterClick}
                            />
                        ) : (
                            <MarkerPoint
                                // By place: a marker keeps its loaded popup data, which must not move to
                                // another place when the list changes order
                                key={place.id ?? `markerPoint${i}`}
                                place={place}
                                keepInView={enableCenterPopup}
                            />
                        )
                    )}

                    {photos?.map((photo, i) =>
                        photo.type === 'cluster' ? (
                            <MarkerPhotoCluster
                                key={`markerPhotoCluster${i}`}
                                marker={photo}
                                onClick={handleClusterClick}
                            />
                        ) : (
                            <MarkerPhoto
                                key={`markerPhoto${i}`}
                                photo={photo}
                                index={i}
                                onPhotoClick={handlePhotoMarkerClick}
                            />
                        )
                    )}

                    {pins?.map((pin, i) => (
                        <MarkerPin
                            key={`markerPin${i}`}
                            pin={pin}
                        />
                    ))}

                    {enableContextMenu && <ContextMenu />}

                    {enableRuler && activeTool === 'ruler' && <Ruler />}

                    {enableAreaMeasure && activeTool === 'area' && <AreaMeasure />}

                    <div className={styles.leftControls}>
                        {onClickCreatePlace && (
                            <Button
                                size={controlsSize}
                                mode={'secondary'}
                                icon={'PlusCircle'}
                                tooltip={t('create-geotag', { defaultValue: 'Добавить геометку' })}
                                onClick={onClickCreatePlace}
                            />
                        )}

                        {enableFullScreen && (
                            <Button
                                size={controlsSize}
                                mode={'secondary'}
                                icon={isFullscreen ? 'FullscreenOut' : 'FullscreenIn'}
                                tooltip={
                                    isFullscreen
                                        ? t('fullscreen-exit', { defaultValue: 'Выйти из полноэкранного режима' })
                                        : t('fullscreen-enter', { defaultValue: 'Во весь экран' })
                                }
                                onClick={handleToggleFullscreen}
                            />
                        )}

                        {enableRuler && (
                            <Button
                                size={controlsSize}
                                mode={'secondary'}
                                className={cn(activeTool === 'ruler' && styles.activeControl)}
                                icon={'Ruler'}
                                aria-pressed={activeTool === 'ruler'}
                                tooltip={
                                    activeTool === 'ruler'
                                        ? t('ruler-off', { defaultValue: 'Выключить линейку' })
                                        : t('ruler-on', { defaultValue: 'Измерить расстояние' })
                                }
                                onClick={() => toggleTool('ruler')}
                            />
                        )}

                        {enableAreaMeasure && (
                            <Button
                                size={controlsSize}
                                mode={'secondary'}
                                className={cn(styles.customIconControl, activeTool === 'area' && styles.activeControl)}
                                aria-pressed={activeTool === 'area'}
                                aria-label={
                                    activeTool === 'area'
                                        ? t('area-measure-off', { defaultValue: 'Выключить измерение площади' })
                                        : t('area-measure-on', { defaultValue: 'Измерить площадь' })
                                }
                                tooltip={
                                    activeTool === 'area'
                                        ? t('area-measure-off', { defaultValue: 'Выключить измерение площади' })
                                        : t('area-measure-on', { defaultValue: 'Измерить площадь' })
                                }
                                onClick={() => toggleTool('area')}
                            >
                                <AreaIcon />
                            </Button>
                        )}

                        {userLatLon && (
                            <Button
                                size={controlsSize}
                                mode={'secondary'}
                                icon={'Position'}
                                tooltip={t('my-location', { defaultValue: 'Моё местоположение' })}
                                onClick={handleUserPosition}
                            />
                        )}

                        {fullMapLink && (
                            <Button
                                size={controlsSize}
                                noIndex={true}
                                mode={'secondary'}
                                icon={'External'}
                                tooltip={t('open-on-map', { defaultValue: 'Открыть на карте' })}
                                link={fullMapLink}
                            />
                        )}
                    </div>

                    <div className={styles.rightControls}>
                        {enableLayersSwitcher && (
                            <LayerSwitcherControl
                                currentLayer={mapLayer}
                                currentType={mapType}
                                hideAdditionalLayers={hideAdditionalLayers}
                                additionalLayers={additionalLayers}
                                onSwitchMapLayer={setMapLayer}
                                onSwitchMapType={handleSwitchMapType}
                                onSwitchAdditionalLayers={setAdditionalLayers}
                            />
                        )}

                        {enableCategoryControl && (
                            <CategoryControl
                                categories={categories}
                                onChangeCategories={onChangeCategories}
                            />
                        )}
                    </div>

                    <div className={styles.bottomControls}>
                        {/* Layers' panels go here, above the coordinates and as wide as them */}
                        <div
                            ref={setBottomSlot}
                            className={enableCoordsControl ? styles.bottomSlot : styles.bottomSlotStandalone}
                        />
                        {enableCoordsControl && <CoordinatesControl coordinates={mapPosition} />}
                    </div>

                    {userLatLon && <MarkerUser coordinates={userLatLon} />}
                    <div
                        className={styles.loader}
                        style={{ display: loading ? 'block' : 'none' }}
                    >
                        <Spinner />
                    </div>
                    {onChangeBounds && <MapEvents onChangeBounds={handleChangeBounds} />}
                </MapControlsContext.Provider>
            </ReactLeaflet.MapContainer>
        </div>
    )
}

export default InteractiveMap
