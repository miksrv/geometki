import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Marker, Pane, Polygon, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import L, { LatLng } from 'leaflet'
import { Button } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { formatArea, formatDistance, geodesicArea } from '@/utils/geo'

import { hasNoHover, isMeasureToolKey } from '../ruler/utils'

// Vertices, labels, the panel and the measuring mode of the map look the same as the ruler's
import rulerStyles from '../ruler/styles.module.sass'
import styles from './styles.module.sass'

const AREA_PANE = 'areaMeasurePane'

// A click this close to the last point (px) closes the polygon instead of adding a point:
// that is also how a double click ends up (its two clicks land on the same spot)
const FINISH_CLICK_RADIUS = 8

const MIN_POINTS = 3

/** Length of the closed outline, metres */
const perimeter = (map: L.Map, points: LatLng[]): number =>
    points.length < 2
        ? 0
        : points.reduce((sum, point, index) => sum + map.distance(point, points[(index + 1) % points.length]), 0)

const midpoint = (map: L.Map, a: LatLng, b: LatLng): LatLng =>
    map.unproject(map.project(a).add(map.project(b)).divideBy(2))

/**
 * Area measuring tool, rendered inside the map while it is on.
 *
 * - a click adds a point; a dashed outline follows the cursor with the area next to it;
 * - a click on the first or the last point, or a double click, closes the polygon;
 *   map clicks are ignored after that, until it is cleared;
 * - points can be dragged; a click on a point removes it (a closed polygon keeps three);
 * - a click on the small handle in the middle of an edge, or dragging it, adds a point there;
 * - Backspace removes the last point, Esc clears everything;
 * - place markers don't catch clicks meanwhile, so points can be put right on them.
 *
 * The cursor-following outline and label are Leaflet layers updated directly once per frame,
 * not React state, so moving the mouse costs no re-renders.
 */
export const AreaMeasure: React.FC = () => {
    const { t, i18n } = useTranslation()
    const map = useMap()

    const [points, setPoints] = useState<LatLng[]>([])
    const [closed, setClosed] = useState(false)

    const pointsRef = useRef(points)
    pointsRef.current = points
    const closedRef = useRef(closed)
    closedRef.current = closed

    const cursorRef = useRef<LatLng | null>(null)
    const frameRef = useRef(0)
    const rubberRef = useRef<L.Polyline | null>(null)
    const cursorLabelRef = useRef<L.Tooltip | null>(null)
    const panelRef = useRef<HTMLDivElement>(null)

    const locale = i18n.language
    const vertexIcon = useMemo(() => L.divIcon({ className: rulerStyles.vertex, iconSize: [12, 12] }), [])
    const midpointIcon = useMemo(() => L.divIcon({ className: styles.midpoint, iconSize: [10, 10] }), [])

    const area = useMemo(() => geodesicArea(points), [points])
    const outline = useMemo(() => perimeter(map, points), [map, points])

    // Edges that get a handle for a new point: all of them once closed, the drawn ones before that
    const edges = useMemo(
        () =>
            points
                .map((point, index) => ({ from: point, index, to: points[(index + 1) % points.length] }))
                .filter(({ index }) => points.length > 1 && (closed || index < points.length - 1)),
        [points, closed]
    )

    // Rubber band (last point → cursor → first point) and cursor label: plain Leaflet layers,
    // repainted once per animation frame
    const paintCursor = useCallback(() => {
        frameRef.current = 0

        const rubber = rubberRef.current
        const label = cursorLabelRef.current
        const current = pointsRef.current
        const cursor = cursorRef.current

        if (!rubber || !label) {
            return
        }

        if (!cursor || !current.length || closedRef.current) {
            rubber.setLatLngs([])
            label.remove()
            return
        }

        rubber.setLatLngs(current.length > 1 ? [current[current.length - 1], cursor, current[0]] : [current[0], cursor])

        if (current.length < 2) {
            label.remove()
            return
        }

        label.setLatLng(cursor)
        label.setContent(formatArea(geodesicArea([...current, cursor]), locale))

        if (!map.hasLayer(label)) {
            label.addTo(map)
        }
    }, [map, locale])

    const scheduleCursorPaint = useCallback(() => {
        if (!frameRef.current) {
            frameRef.current = requestAnimationFrame(paintCursor)
        }
    }, [paintCursor])

    const addPoint = (latlng: LatLng) => {
        if (closedRef.current) {
            return
        }

        const last = pointsRef.current[pointsRef.current.length - 1]

        if (
            last &&
            map.latLngToContainerPoint(last).distanceTo(map.latLngToContainerPoint(latlng)) < FINISH_CLICK_RADIUS
        ) {
            if (pointsRef.current.length >= MIN_POINTS) {
                setClosed(true)
            }
            return
        }

        setPoints((prev) => [...prev, latlng])
    }

    const removeLastPoint = () => {
        setPoints((prev) => prev.slice(0, -1))

        if (pointsRef.current.length - 1 < MIN_POINTS) {
            setClosed(false)
        }
    }

    const clear = () => {
        setPoints([])
        setClosed(false)
    }

    // Map controls (buttons, panels) sit inside the map container and their clicks reach the
    // map too; only events on the map itself count. See the same check in the ruler.
    const isOnMap = (event: L.LeafletMouseEvent) => {
        const target = event.originalEvent.target as Node

        return target === map.getContainer() || !!map.getPane('mapPane')?.contains(target)
    }

    useMapEvents({
        click: (event) => {
            if (isOnMap(event)) {
                addPoint(event.latlng)
            }
        },
        mousemove: (event) => {
            cursorRef.current = isOnMap(event) && !hasNoHover() ? event.latlng : null
            scheduleCursorPaint()
        },
        mouseout: () => {
            cursorRef.current = null
            scheduleCursorPaint()
        }
    })

    // Map setup for the measuring mode: own layers, no double-click zoom (a double click
    // closes the polygon), markers of places let clicks through
    useEffect(() => {
        const container = map.getContainer()
        const doubleClickZoom = map.doubleClickZoom.enabled()

        rubberRef.current = L.polyline([], { className: rulerStyles.rubberBand, interactive: false }).addTo(map)
        cursorLabelRef.current = L.tooltip({
            className: rulerStyles.cursorLabel,
            direction: 'right',
            offset: [14, 0],
            permanent: true
        })

        map.doubleClickZoom.disable()
        container.classList.add(rulerStyles.rulerActive)

        return () => {
            cancelAnimationFrame(frameRef.current)
            frameRef.current = 0
            rubberRef.current?.remove()
            cursorLabelRef.current?.remove()
            container.classList.remove(rulerStyles.rulerActive)

            if (doubleClickZoom) {
                map.doubleClickZoom.enable()
            }
        }
    }, [map])

    useEffect(() => {
        scheduleCursorPaint()
    }, [points, closed, scheduleCursorPaint])

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!isMeasureToolKey(event, map.getContainer())) {
                return
            }

            if (event.key === 'Escape') {
                clear()
            } else if (event.key === 'Backspace' || event.key === 'Delete') {
                event.preventDefault()
                removeLastPoint()
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [map])

    // Clicks and scrolls on the panel must not reach the map (no points, no zoom)
    const hasPanel = points.length >= MIN_POINTS
    useEffect(() => {
        if (hasPanel && panelRef.current) {
            L.DomEvent.disableClickPropagation(panelRef.current)
            L.DomEvent.disableScrollPropagation(panelRef.current)
        }
    }, [hasPanel])

    const handleVertexClick = (index: number) => {
        const isEnd = index === 0 || index === points.length - 1

        if (!closed && isEnd) {
            if (points.length >= MIN_POINTS) {
                setClosed(true)
            }
        } else if (!closed || points.length > MIN_POINTS) {
            setPoints((prev) => prev.filter((_, i) => i !== index))
        }
    }

    // Dragging repaints at most once per frame
    const dragFrameRef = useRef(0)
    const handleVertexDrag = (index: number, latlng: LatLng) => {
        cancelAnimationFrame(dragFrameRef.current)
        dragFrameRef.current = requestAnimationFrame(() =>
            setPoints((prev) => prev.map((point, i) => (i === index ? latlng : point)))
        )
    }

    const insertPoint = (afterIndex: number, latlng: LatLng) =>
        setPoints((prev) => [...prev.slice(0, afterIndex + 1), latlng, ...prev.slice(afterIndex + 1)])

    return (
        <>
            <Pane
                name={AREA_PANE}
                style={{ zIndex: 650 }}
            >
                {points.length >= MIN_POINTS && (
                    <Polygon
                        positions={points}
                        pathOptions={{ className: closed ? styles.polygon : styles.draftPolygon, interactive: false }}
                    >
                        {closed && (
                            <Tooltip
                                permanent={true}
                                direction={'center'}
                                className={rulerStyles.totalLabel}
                            >
                                {formatArea(area, locale)}
                            </Tooltip>
                        )}
                    </Polygon>
                )}

                {points.length === 2 && (
                    <Polyline
                        positions={points}
                        pathOptions={{ className: rulerStyles.line, interactive: false }}
                    />
                )}

                {edges.map(({ from, index, to }) => (
                    <Marker
                        // The handle is a new marker for each new set of points: a dragged handle
                        // is put back to the middle of the edge
                        key={`${index}-${from.lat}-${from.lng}-${to.lat}-${to.lng}`}
                        position={midpoint(map, from, to)}
                        icon={midpointIcon}
                        draggable={true}
                        bubblingMouseEvents={false}
                        eventHandlers={{
                            click: () => insertPoint(index, midpoint(map, from, to)),
                            dragend: (event) => insertPoint(index, (event.target as L.Marker).getLatLng())
                        }}
                    />
                ))}

                {points.map((point, index) => (
                    <Marker
                        key={index}
                        position={point}
                        icon={vertexIcon}
                        zIndexOffset={1000}
                        draggable={true}
                        bubblingMouseEvents={false}
                        eventHandlers={{
                            click: () => handleVertexClick(index),
                            drag: (event) => handleVertexDrag(index, (event.target as L.Marker).getLatLng())
                        }}
                    />
                ))}
            </Pane>

            {hasPanel && (
                <div
                    ref={panelRef}
                    className={rulerStyles.panel}
                >
                    <span className={rulerStyles.total}>
                        {t('area-measure-area', { defaultValue: 'Площадь' })}
                        {': '}
                        <b>{formatArea(area, locale)}</b>
                    </span>

                    <span className={rulerStyles.total}>
                        {t('area-measure-perimeter', { defaultValue: 'Периметр' })}
                        {': '}
                        <b>{formatDistance(outline, locale)}</b>
                    </span>

                    <span className={rulerStyles.actions}>
                        <Button
                            size={'small'}
                            mode={'link'}
                            label={t('ruler-undo', { defaultValue: 'Отменить точку' })}
                            onClick={removeLastPoint}
                        />
                        <Button
                            size={'small'}
                            mode={'link'}
                            label={t('ruler-clear', { defaultValue: 'Сбросить' })}
                            onClick={clear}
                        />
                    </span>
                </div>
            )}
        </>
    )
}
