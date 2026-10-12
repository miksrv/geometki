import React, { useRef, useState } from 'react'
import { Polyline, Popup, useMapEvents } from 'react-leaflet'
import { LatLng } from 'leaflet'
import { Icon, Skeleton } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'
import { skipToken } from '@reduxjs/toolkit/query'

import { APIWaymarkedTrails, WaymarkedRouteItem, waymarkedTrailsHost } from '@/api/apiWaymarkedTrails'
import { formatDistance } from '@/utils/geo'

import { MapTrailsLayerEnum } from '../types'

import { bboxToBounds, clickBbox, collectRouteLines } from './utils'

import styles from './styles.module.sass'

// Below it a click covers too much ground to tell the routes apart, and every click would ask the service
export const TRAILS_INFO_MIN_ZOOM = 12

// How far from the click (px) a route still counts as clicked: the lines are a few pixels wide
const CLICK_RADIUS = 8

type FoundRoute = WaymarkedRouteItem & { map: MapTrailsLayerEnum }

interface TrailsInfoProps {
    trails: MapTrailsLayerEnum[]
    // A measuring tool owns the clicks
    disabled?: boolean
}

const symbolUrl = (route: FoundRoute) =>
    route.symbol_id ? `${waymarkedTrailsHost(route.map)}/api/v1/symbols/id/${route.symbol_id}.svg` : undefined

/**
 * A click on the map with the trails layer on asks Waymarked Trails which routes pass there:
 * one is shown at once, several as a list. The chosen route is highlighted on the map
 */
export const TrailsInfo: React.FC<TrailsInfoProps> = ({ trails, disabled }) => {
    const { t, i18n } = useTranslation()
    const locale = i18n.language

    const [position, setPosition] = useState<LatLng>()
    const [routes, setRoutes] = useState<FoundRoute[]>([])
    const [selected, setSelected] = useState<FoundRoute>()
    // Only the last click's answer is shown: an earlier, slower one is dropped
    const requestRef = useRef(0)

    const [getByArea] = APIWaymarkedTrails.useLazyGetByAreaQuery()
    // `currentData`: while another route loads (or fails), the previous one's card is not shown for it
    const { currentData: details, isFetching } = APIWaymarkedTrails.useGetRelationQuery(
        selected ? { id: selected.id, locale, map: selected.map } : skipToken
    )

    const lines = details ? collectRouteLines(details.route) : []

    const map = useMapEvents({
        click: async (event) => {
            if (disabled || map.getZoom() < TRAILS_INFO_MIN_ZOOM || !isOnMap(event.originalEvent.target as Node)) {
                return
            }

            const request = ++requestRef.current
            const bbox = clickBbox(
                (point) => map.containerPointToLatLng(point),
                map.latLngToContainerPoint(event.latlng),
                CLICK_RADIUS
            )

            const found = await Promise.all(
                trails.map((type) =>
                    getByArea({ bbox, locale, map: type }, true)
                        .unwrap()
                        .then(({ results }) =>
                            results
                                .filter((item) => item.type === 'relation')
                                .map((item): FoundRoute => ({ ...item, map: type }))
                        )
                        .catch(() => [] as FoundRoute[])
                )
            )

            if (request !== requestRef.current) {
                return
            }

            const list = found.flat()

            if (!list.length) {
                return
            }

            setPosition(event.latlng)
            setRoutes(list)
            setSelected(list.length === 1 ? list[0] : undefined)
        }
    })

    // Clicks on the map's buttons and panels reach the map too: only a click on the map itself counts
    // (the trails and hillshade panes have `pointer-events: none`), see the ruler
    const isOnMap = (target: Node) => target === map.getContainer() || !!map.getPane('mapPane')?.contains(target)

    const handleClose = () => {
        setPosition(undefined)
        setRoutes([])
        setSelected(undefined)
    }

    const handleShowWhole = () => {
        if (details?.bbox) {
            map.fitBounds(bboxToBounds(details.bbox), { padding: [40, 40] })
        }
    }

    const titleMap: Record<MapTrailsLayerEnum, string> = {
        [MapTrailsLayerEnum.HIKING]: t('trails-info_Hiking', { defaultValue: 'Пеший маршрут' }),
        [MapTrailsLayerEnum.CYCLING]: t('trails-info_Cycling', { defaultValue: 'Веломаршрут' }),
        [MapTrailsLayerEnum.SLOPES]: t('trails-info_Slopes', { defaultValue: 'Лыжная трасса' })
    }

    const routeName = (route: WaymarkedRouteItem) => route.name || route.ref || `#${route.id}`

    const renderSymbol = (route: FoundRoute) => {
        const src = symbolUrl(route)

        return src ? (
            <img
                className={styles.symbol}
                src={src}
                alt={''}
            />
        ) : null
    }

    const sources = selected
        ? [
              details?.url
                  ? { href: details.url, label: t('trails-info_Website', { defaultValue: 'Сайт' }) }
                  : undefined,
              {
                  href: `${waymarkedTrailsHost(selected.map)}/#route?id=${selected.id}`,
                  label: 'WMT',
                  title: 'Waymarked Trails'
              },
              { href: `https://www.openstreetmap.org/relation/${selected.id}`, label: 'OSM', title: 'OpenStreetMap' }
          ].filter((source) => !!source)
        : []

    if (!position) {
        return null
    }

    return (
        <>
            {!!lines.length && (
                <>
                    <Polyline
                        positions={lines}
                        interactive={false}
                        pathOptions={{ color: '#fff', opacity: 0.9, weight: 9 }}
                    />
                    <Polyline
                        positions={lines}
                        interactive={false}
                        pathOptions={{ color: '#ff3d00', opacity: 0.9, weight: 5 }}
                    />
                </>
            )}

            <Popup
                key={`${position.lat},${position.lng}`}
                position={position}
                className={styles.trailsPopup}
                eventHandlers={{ remove: handleClose }}
            >
                <div className={styles.content}>
                    {!selected ? (
                        <>
                            <h4 className={styles.title}>
                                {t('trails-info_RoutesHere', { defaultValue: 'Маршруты здесь' })}
                            </h4>
                            <ul className={styles.list}>
                                {routes.map((route) => (
                                    <li key={`${route.map}-${route.id}`}>
                                        <button
                                            type={'button'}
                                            onClick={() => setSelected(route)}
                                        >
                                            {renderSymbol(route)}
                                            <span>
                                                <span className={styles.name}>{routeName(route)}</span>
                                                <span className={styles.meta}>{titleMap[route.map]}</span>
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </>
                    ) : (
                        <>
                            {routes.length > 1 && (
                                <button
                                    type={'button'}
                                    className={styles.back}
                                    onClick={() => setSelected(undefined)}
                                >
                                    {t('trails-info_Back', { defaultValue: '← Все маршруты здесь' })}
                                </button>
                            )}

                            <div className={styles.header}>
                                {renderSymbol(selected)}
                                <div>
                                    <h4 className={styles.title}>{routeName(details ?? selected)}</h4>
                                    <span className={styles.meta}>
                                        {titleMap[selected.map]}
                                        {details?.ref && details.name ? ` · ${details.ref}` : ''}
                                    </span>
                                </div>
                            </div>

                            {isFetching ? (
                                <>
                                    <Skeleton className={styles.skeletonLine} />
                                    <Skeleton className={styles.skeletonLineShort} />
                                </>
                            ) : (
                                <>
                                    <dl className={styles.facts}>
                                        {!!details?.route?.length && (
                                            <>
                                                <dt>{t('trails-info_Length', { defaultValue: 'Длина' })}</dt>
                                                <dd>{formatDistance(details.route.length, locale)}</dd>
                                            </>
                                        )}
                                        {details?.operator && (
                                            <>
                                                <dt>{t('trails-info_Operator', { defaultValue: 'Оператор' })}</dt>
                                                <dd title={details.operator}>{details.operator}</dd>
                                            </>
                                        )}
                                    </dl>

                                    {details?.description && (
                                        <p className={styles.description}>{details.description}</p>
                                    )}

                                    <div className={styles.links}>
                                        {!!details?.bbox && (
                                            <button
                                                type={'button'}
                                                onClick={handleShowWhole}
                                            >
                                                {t('trails-info_ShowWhole', { defaultValue: 'Показать целиком' })}
                                            </button>
                                        )}
                                        {sources.map((source) => (
                                            <a
                                                key={source.label}
                                                href={source.href}
                                                title={source.title}
                                                target={'_blank'}
                                                rel={'noreferrer'}
                                            >
                                                {source.label}
                                                <Icon name={'External'} />
                                            </a>
                                        ))}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            </Popup>
        </>
    )
}
