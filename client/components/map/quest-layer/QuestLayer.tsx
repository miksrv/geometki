import React, { useMemo } from 'react'
import { Circle, Marker, Polyline, Tooltip } from 'react-leaflet'
import Leaflet from 'leaflet'

import { categoryImage } from '@/utils/categories'

import { QuestPointMark, QuestZoneMark } from '../types'

import styles from './styles.module.sass'

// Leaflet paints a path from its options: the brand blue of the hex layer (DESIGN.md → Hex layer)
const LINE_COLOR = '#3770b1'
const DONE_COLOR = '#2f7d43'

/** A colour of the site's theme, as the marks use it (the map is drawn in the browser only) */
const themeColor = (name: string, fallback: string): string =>
    (typeof window !== 'undefined' && getComputedStyle(document.documentElement).getPropertyValue(name).trim()) ||
    fallback

const CHECK = '<svg viewBox="0 0 10 10" focusable="false" aria-hidden="true"><path d="M2.2 5.2l1.9 1.9 3.7-3.9"/></svg>'

const icon = (point: QuestPointMark): Leaflet.Icon | Leaflet.DivIcon =>
    // A confirmed point: the place's category, as on every map of the site (no popup here)
    point.state === 'done' && point.category
        ? new Leaflet.Icon({
              className: styles.category,
              iconAnchor: [10, 10],
              iconSize: [20, 20],
              iconUrl: categoryImage(point.category).src,
              tooltipAnchor: [0, -12]
          })
        : new Leaflet.DivIcon({
              className: '',
              html: `<span class="${styles.point} ${styles[point.state]}">${point.state === 'done' ? CHECK : point.label}</span>`,
              iconAnchor: [14, 14],
              iconSize: [28, 28]
          })

interface QuestLayerProps {
    points: QuestPointMark[]
    /** The search zones of riddle quests: dashed circles under the marks */
    zones?: QuestZoneMark[]
    onPointClick?: (id: string) => void
}

/**
 * A quest of the game on a map: the points the walker has opened, numbered in the quest's
 * order — a confirmed one is its place's category icon (a green check without one), the one to
 * go to is filled, the rest are outlined — and a solid line through them, as the timeline of the
 * page: green between two confirmed points, blue to a point still ahead. The line is drawn
 * between opened points only: where a step or a riddle is still closed, the map says nothing.
 */
export const QuestLayer: React.FC<QuestLayerProps> = ({ points, zones, onPointClick }) => {
    const colors = useMemo(
        () => ({ ahead: themeColor('--color-main', LINE_COLOR), done: themeColor('--color-green', DONE_COLOR) }),
        []
    )
    // A leg between two points: green once both are confirmed, blue while the next is still ahead
    const legs = useMemo(
        () =>
            points.slice(1).map((point, index) => {
                const from = points[index]

                return {
                    done: from.state === 'done' && point.state === 'done',
                    id: `${from.id}-${point.id}`,
                    positions: [
                        [from.lat, from.lon],
                        [point.lat, point.lon]
                    ] as Array<[number, number]>
                }
            }),
        [points]
    )

    return (
        <>
            {zones?.map((zone) => (
                <Circle
                    key={zone.id}
                    center={[zone.lat, zone.lon]}
                    radius={zone.radius}
                    pathOptions={{
                        color: LINE_COLOR,
                        dashArray: '6 8',
                        fillColor: LINE_COLOR,
                        fillOpacity: 0.08,
                        opacity: 0.8,
                        weight: 2
                    }}
                    interactive={false}
                />
            ))}

            {legs.map((leg) => (
                <Polyline
                    key={leg.id}
                    positions={leg.positions}
                    pathOptions={{
                        color: leg.done ? colors.done : colors.ahead,
                        lineCap: 'round',
                        opacity: 0.9,
                        weight: 3
                    }}
                    interactive={false}
                />
            ))}

            {points.map((point) => (
                <Marker
                    key={point.id}
                    position={[point.lat, point.lon]}
                    icon={icon(point)}
                    // The point to go to is drawn over its neighbours
                    zIndexOffset={point.state === 'current' ? 1000 : 0}
                    eventHandlers={onPointClick ? { click: () => onPointClick(point.id) } : undefined}
                >
                    {point.title && (
                        <Tooltip
                            direction={'top'}
                            offset={point.state === 'done' && point.category ? [0, 0] : [0, -14]}
                        >
                            {point.title}
                        </Tooltip>
                    )}
                </Marker>
            ))}
        </>
    )
}
