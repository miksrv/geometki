import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as ReactLeaflet from 'react-leaflet'
import { LatLngBounds, LatLngExpression, Map, MapOptions } from 'leaflet'
import isEqual from 'lodash-es/isEqual'
import { Button, cn, Spinner } from 'simple-react-ui-kit'

import { useRouter } from 'next/dist/client/router'

import { ApiModel, ApiType } from '@/api'
import { LOCAL_STORAGE } from '@/config/constants'
import useLocalStorage from '@/hooks/useLocalStorage'

import { CategoryControl } from './category-control'
import { ContextMenu } from './context-menu'
import { CoordinatesControl } from './coordinates-control'
import { HeatmapLayer } from './heatmap-layer'
import { HistoricalPhotos } from './historical-photos'
import { LayerSwitcherControl } from './layer-switcher-control'
import { MapEvents } from './MapEvents'
import { MarkerPhoto } from './marker-photo'
import { MarkerPhotoCluster } from './marker-photo-cluster'
import { MarkerPoint } from './marker-point'
import { MarkerPointCluster } from './marker-point-cluster'
import { MarkerUser } from './marker-user'
import { PlaceMark } from './place-mark'
import { MapAdditionalLayersEnum, MapLayersEnum, MapObjectsTypeEnum, MapPositionType } from './types'

import 'leaflet/dist/leaflet.css'
import styles from './styles.module.sass'

type MapProps = {
    places?: ApiModel.PlaceMark[]
    photos?: ApiModel.PhotoMark[]
    categories?: ApiModel.Categories[]
    layer?: MapLayersEnum
    loading?: boolean
    storeMapPosition?: boolean
    enableCenterPopup?: boolean
    enableFullScreen?: boolean
    enableCoordsControl?: boolean
    enableCategoryControl?: boolean
    enableLayersSwitcher?: boolean
    enableContextMenu?: boolean
    hideAdditionalLayers?: boolean
    storeMapKey?: string
    fullMapLink?: string
    userLatLon?: ApiType.Coordinates
    onChangeCategories?: (categories?: ApiModel.Categories[]) => void
    onChangeMapType?: (type?: MapObjectsTypeEnum) => void
    onChangeBounds?: (bounds: LatLngBounds, zoom: number) => void
    onPhotoClick?: (photos: ApiModel.PhotoMark[], index?: number) => void
    onClickCreatePlace?: () => void
    controlsSize?: 'small' | 'medium'
} & MapOptions

const DEFAULT_MAP_ZOOM = 12
const DEFAULT_MAP_CENTER: LatLngExpression = [51.765445, 55.099745]
const DEFAULT_MAP_LAYER = MapLayersEnum.OSM
const DEFAULT_MAP_TYPE = MapObjectsTypeEnum.PLACES

interface CursorCoordinatesDisplayProps {
    mapPosition?: ApiType.Coordinates
    enableCoordsControl?: boolean
    coordinatesOpen: boolean
    onChangeOpen: (open: boolean) => void
}

const CursorCoordinatesDisplay: React.FC<CursorCoordinatesDisplayProps> = React.memo(
    ({ mapPosition, enableCoordsControl, coordinatesOpen, onChangeOpen }) => {
        const [cursorPosition, setCursorPosition] = useState<ApiType.Coordinates>()

        const handleMouseMove = useCallback((coords: ApiType.Coordinates) => {
            setCursorPosition(coords)
        }, [])

        return (
            <>
                <div className={styles.bottomControls}>
                    {enableCoordsControl && (
                        <CoordinatesControl
                            coordinates={cursorPosition ?? mapPosition}
                            onChangeOpen={onChangeOpen}
                        />
                    )}
                </div>
                {enableCoordsControl && coordinatesOpen && <MapEvents onMouseMove={handleMouseMove} />}
            </>
        )
    }
)

CursorCoordinatesDisplay.displayName = 'CursorCoordinatesDisplay'

export const InteractiveMap: React.FC<MapProps> = ({
    places,
    photos,
    categories,
    // layer,
    loading,
    storeMapPosition,
    enableCenterPopup,
    enableFullScreen,
    enableCoordsControl,
    enableCategoryControl,
    enableLayersSwitcher,
    enableContextMenu,
    hideAdditionalLayers,
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
    const router = useRouter()
    const mapRef = useRef<Map>(null)

    const [readyStorage, setReadyStorage] = useState<boolean>(false)
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
    const [coordinatesOpen, setCoordinatesOpen] = useState<boolean>(false)
    const [placeMark, setPlaceMark] = useState<ApiType.Coordinates>()
    const [mapPosition, setMapPosition] = useState<MapPositionType>()
    const [mapLayer, setMapLayer] = useState<MapLayersEnum>(DEFAULT_MAP_LAYER)
    const [mapType, setMapType] = useState<MapObjectsTypeEnum>(DEFAULT_MAP_TYPE)
    const [additionalLayers, setAdditionalLayers] = useState<MapAdditionalLayersEnum[]>()

    const [coordinates, setCoordinates] = useLocalStorage<MapPositionType>(storeMapKey || LOCAL_STORAGE.MAP_CENTER)

    const handleUserPosition = () => {
        if (userLatLon?.lat && userLatLon.lon) {
            mapRef.current?.setView([userLatLon.lat, userLatLon.lon], DEFAULT_MAP_ZOOM)
        }
    }

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
        if (props.center || props.zoom) {
            mapRef.current?.setView(
                props.center ?? DEFAULT_MAP_CENTER,
                mapPosition?.zoom ?? props.zoom ?? DEFAULT_MAP_ZOOM
            )
        }
    }, [props.center, props.zoom])

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
                center={props.center ?? DEFAULT_MAP_CENTER}
                zoom={props.zoom ?? DEFAULT_MAP_ZOOM}
                minZoom={6}
                style={{
                    cursor: enableCoordsControl ? 'crosshair' : props.dragging ? 'pointer' : 'default',
                    height: '100%',
                    width: '100%'
                }}
                attributionControl={false}
                ref={mapRef}
            >
                {additionalLayers?.includes(MapAdditionalLayersEnum.HEATMAP) && <HeatmapLayer />}

                {additionalLayers?.includes(MapAdditionalLayersEnum.HISTORICAL_PHOTOS) && (
                    <HistoricalPhotos
                        position={mapPosition}
                        onPhotoClick={onPhotoClick}
                    />
                )}

                {mapLayer === MapLayersEnum.OCM && (
                    <ReactLeaflet.TileLayer
                        attribution='Open Cycle Map'
                        url={`https://tile.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=${process.env.NEXT_PUBLIC_CYCLEMAP_TOKEN}`}
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
                            onClick={(coords) =>
                                mapRef.current?.setView([coords.lat, coords.lon], (mapPosition?.zoom ?? 16) + 2)
                            }
                        />
                    ) : (
                        <MarkerPoint
                            key={`markerPoint${i}`}
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
                            onClick={(coords) =>
                                mapRef.current?.setView([coords.lat, coords.lon], (mapPosition?.zoom ?? 16) + 2)
                            }
                        />
                    ) : (
                        <MarkerPhoto
                            key={`markerPhoto${i}`}
                            photo={photo}
                            onPhotoClick={() => onPhotoClick?.(photos, i)}
                        />
                    )
                )}

                {enableContextMenu && <ContextMenu />}

                <div className={styles.leftControls}>
                    {onClickCreatePlace && (
                        <Button
                            size={controlsSize}
                            mode={'secondary'}
                            icon={'PlusCircle'}
                            onClick={onClickCreatePlace}
                        />
                    )}

                    {enableFullScreen && (
                        <Button
                            size={controlsSize}
                            mode={'secondary'}
                            icon={isFullscreen ? 'FullscreenOut' : 'FullscreenIn'}
                            onClick={handleToggleFullscreen}
                        />
                    )}

                    {userLatLon && (
                        <Button
                            size={controlsSize}
                            mode={'secondary'}
                            icon={'Position'}
                            onClick={handleUserPosition}
                        />
                    )}

                    {fullMapLink && (
                        <Button
                            size={controlsSize}
                            noIndex={true}
                            mode={'secondary'}
                            icon={'External'}
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

                <CursorCoordinatesDisplay
                    mapPosition={mapPosition}
                    enableCoordsControl={enableCoordsControl}
                    coordinatesOpen={coordinatesOpen}
                    onChangeOpen={setCoordinatesOpen}
                />

                {userLatLon && <MarkerUser coordinates={userLatLon} />}
                <div
                    className={styles.loader}
                    style={{ display: loading ? 'block' : 'none' }}
                >
                    <Spinner />
                </div>
                {onChangeBounds && <MapEvents onChangeBounds={handleChangeBounds} />}
            </ReactLeaflet.MapContainer>
        </div>
    )
}

export default InteractiveMap
