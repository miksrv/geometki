import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Marker, Pane, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import L, { LatLng } from 'leaflet'
import { Button } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { formatDistance } from '@/utils/geo'

import { hasNoHover, isMeasureToolKey } from './utils'

import styles from './styles.module.sass'

const RULER_PANE = 'rulerPane'

// A click this close to the last point (px) finishes the line instead of adding a point:
// that is also how a double click ends up (its two clicks land on the same spot)
const FINISH_CLICK_RADIUS = 8

/** Cumulative distances along the line, metres: `[0, a→b, a→b→c, …]` */
const cumulativeDistances = (map: L.Map, points: LatLng[]): number[] =>
    points.reduce<number[]>(
        (acc, point, index) => [...acc, index ? acc[index - 1] + map.distance(points[index - 1], point) : 0],
        []
    )

/**
 * Distance measuring tool, rendered inside the map while the ruler is on.
 *
 * - a click adds a point; a dashed line follows the cursor from the last point with the
 *   segment and total length next to it;
 * - points can be dragged; a click on an inner point removes it; a click on the last point
 *   or a double click finishes the line, the next click continues it;
 * - Backspace removes the last point, Esc clears everything;
 * - place markers don't catch clicks meanwhile, so points can be put right on them.
 *
 * The cursor-following line and label are Leaflet layers updated directly once per frame,
 * not React state, so moving the mouse costs no re-renders.
 */
export const Ruler: React.FC = () => {
    const { t, i18n } = useTranslation()
    const map = useMap()

    const [points, setPoints] = useState<LatLng[]>([])
    const [drawing, setDrawing] = useState(true)

    const pointsRef = useRef(points)
    pointsRef.current = points
    const drawingRef = useRef(drawing)
    drawingRef.current = drawing

    const cursorRef = useRef<LatLng | null>(null)
    const frameRef = useRef(0)
    const rubberRef = useRef<L.Polyline | null>(null)
    const cursorLabelRef = useRef<L.Tooltip | null>(null)
    const panelRef = useRef<HTMLDivElement>(null)

    const locale = i18n.language
    const vertexIcon = useMemo(() => L.divIcon({ className: styles.vertex, iconSize: [12, 12] }), [])
    const distances = useMemo(() => cumulativeDistances(map, points), [map, points])
    const total = distances[distances.length - 1] ?? 0

    // Rubber band and cursor label: plain Leaflet layers, repainted once per animation frame
    const paintCursor = useCallback(() => {
        frameRef.current = 0

        const rubber = rubberRef.current
        const label = cursorLabelRef.current
        const last = pointsRef.current[pointsRef.current.length - 1]
        const cursor = cursorRef.current

        if (!rubber || !label) {
            return
        }

        if (!cursor || !last || !drawingRef.current) {
            rubber.setLatLngs([])
            label.remove()
            return
        }

        const segment = map.distance(last, cursor)
        const sum = cumulativeDistances(map, pointsRef.current).pop() ?? 0

        rubber.setLatLngs([last, cursor])
        label.setLatLng(cursor)
        label.setContent(
            pointsRef.current.length > 1
                ? `${formatDistance(segment, locale)} · ${t('ruler-total', { defaultValue: 'всего' })} ${formatDistance(sum + segment, locale)}`
                : formatDistance(segment, locale)
        )

        if (!map.hasLayer(label)) {
            label.addTo(map)
        }
    }, [map, locale, t])

    const scheduleCursorPaint = useCallback(() => {
        if (!frameRef.current) {
            frameRef.current = requestAnimationFrame(paintCursor)
        }
    }, [paintCursor])

    const addPoint = (latlng: LatLng) => {
        const last = pointsRef.current[pointsRef.current.length - 1]

        // A click on the last point's spot finishes the line, or resumes a finished one
        if (
            last &&
            map.latLngToContainerPoint(last).distanceTo(map.latLngToContainerPoint(latlng)) < FINISH_CLICK_RADIUS
        ) {
            setDrawing(!drawingRef.current)
            return
        }

        setPoints((prev) => [...prev, latlng])
        setDrawing(true)
    }

    const removeLastPoint = () => setPoints((prev) => prev.slice(0, -1))

    const clear = () => {
        setPoints([])
        setDrawing(true)
    }

    // Map controls (buttons, panels) sit inside the map container and their clicks reach the
    // map too; only events on the map itself count for the ruler. A click on the map lands on
    // the container element: the tile layer has `pointer-events: none` and the panes are
    // zero-sized, so the panes only catch clicks on markers and vector layers.
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
    // finishes the line), markers of places let clicks through
    useEffect(() => {
        const container = map.getContainer()
        const doubleClickZoom = map.doubleClickZoom.enabled()

        rubberRef.current = L.polyline([], { className: styles.rubberBand, interactive: false }).addTo(map)
        cursorLabelRef.current = L.tooltip({
            className: styles.cursorLabel,
            direction: 'right',
            offset: [14, 0],
            permanent: true
        })

        map.doubleClickZoom.disable()
        container.classList.add(styles.rulerActive)

        return () => {
            cancelAnimationFrame(frameRef.current)
            frameRef.current = 0
            rubberRef.current?.remove()
            cursorLabelRef.current?.remove()
            container.classList.remove(styles.rulerActive)

            if (doubleClickZoom) {
                map.doubleClickZoom.enable()
            }
        }
    }, [map])

    useEffect(() => {
        scheduleCursorPaint()
    }, [points, drawing, scheduleCursorPaint])

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
    const hasPanel = points.length > 1
    useEffect(() => {
        if (hasPanel && panelRef.current) {
            L.DomEvent.disableClickPropagation(panelRef.current)
            L.DomEvent.disableScrollPropagation(panelRef.current)
        }
    }, [hasPanel])

    const handleVertexClick = (index: number) => {
        if (index === points.length - 1) {
            setDrawing((prev) => !prev)
        } else {
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

    return (
        <>
            <Pane
                name={RULER_PANE}
                style={{ zIndex: 650 }}
            >
                {points.length > 1 && (
                    <Polyline
                        positions={points}
                        pathOptions={{ className: styles.line, interactive: false }}
                    />
                )}

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
                    >
                        {index > 0 && (
                            <Tooltip
                                permanent={true}
                                direction={'top'}
                                offset={[0, -8]}
                                className={index === points.length - 1 ? styles.totalLabel : styles.pointLabel}
                            >
                                {formatDistance(distances[index], locale)}
                            </Tooltip>
                        )}
                    </Marker>
                ))}
            </Pane>

            {points.length > 1 && (
                <div
                    ref={panelRef}
                    className={styles.panel}
                >
                    <span className={styles.total}>
                        {t('ruler-distance', { defaultValue: 'Расстояние' })}
                        {': '}
                        <b>{formatDistance(total, locale)}</b>
                    </span>

                    <span className={styles.actions}>
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
