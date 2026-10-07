import React, { useEffect, useLayoutEffect, useRef } from 'react'
import { useMapEvents } from 'react-leaflet'
import type { LatLng } from 'leaflet'
import { Container } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'

import styles from './styles.module.sass'

interface CoordinatesControlProps {
    /** Shown while there is no cursor over the map (touch screens, cursor outside): the map center */
    coordinates?: ApiType.Coordinates
}

const formatCoordinate = (value?: number) => (typeof value === 'number' ? value.toFixed(5) : '—')

/**
 * Always-on readout of the coordinates under the cursor. Mouse moves don't go through React
 * state: the latest position is kept in a ref and written into the two text nodes at most
 * once per animation frame, so the map pays one `textContent` update per frame and nothing
 * re-renders while the cursor moves.
 */
export const CoordinatesControl: React.FC<CoordinatesControlProps> = ({ coordinates }) => {
    const { t } = useTranslation()

    const latRef = useRef<HTMLSpanElement>(null)
    const lonRef = useRef<HTMLSpanElement>(null)
    const cursorRef = useRef<LatLng | null>(null)
    const frameRef = useRef(0)
    const fallbackRef = useRef(coordinates)
    fallbackRef.current = coordinates

    const paint = () => {
        frameRef.current = 0

        const lat = cursorRef.current?.lat ?? fallbackRef.current?.lat
        const lon = cursorRef.current?.lng ?? fallbackRef.current?.lon

        if (latRef.current) {
            latRef.current.textContent = formatCoordinate(lat)
        }
        if (lonRef.current) {
            lonRef.current.textContent = formatCoordinate(lon)
        }
    }

    const schedulePaint = () => {
        if (!frameRef.current) {
            frameRef.current = requestAnimationFrame(paint)
        }
    }

    useMapEvents({
        mousemove: (event) => {
            cursorRef.current = event.latlng
            schedulePaint()
        },
        mouseout: () => {
            cursorRef.current = null
            schedulePaint()
        }
    })

    // The map center is shown until the cursor comes over the map, and again after it leaves
    useLayoutEffect(() => {
        if (!cursorRef.current) {
            paint()
        }
    }, [coordinates?.lat, coordinates?.lon])

    useEffect(() => () => cancelAnimationFrame(frameRef.current), [])

    // The text nodes are filled by `paint` only, so a re-render never overwrites the cursor position
    return (
        <Container
            className={styles.coordinatesControl}
            aria-label={t('coordinates-cursor', { defaultValue: 'Координаты курсора' })}
        >
            <b>{'Lat:'}</b>
            <span ref={latRef} />
            <b>{'Lon:'}</b>
            <span ref={lonRef} />
        </Container>
    )
}
