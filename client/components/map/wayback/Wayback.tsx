import React, { useEffect, useRef, useState } from 'react'
import { useMapEvents } from 'react-leaflet'
import Leaflet from 'leaflet'
import { Icon, Spinner } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { WAYBACK_TILE_URL, WaybackRelease } from '@/api/apiWayback'
import { formatDate } from '@/utils/date'

import { FallbackTileLayer } from '../fallback-tile-layer'

import { useLocalChanges, WaybackTile } from './useLocalChanges'
import { centerTile, pickRelease } from './utils'

import styles from './styles.module.sass'

// Today's imagery, shown while the archive of the area is looked up
const CURRENT_IMAGERY_URL =
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

const DEBOUNCE_MS = 500

interface WaybackProps {
    onClose?: () => void
}

/**
 * The ESRI World Imagery archive (Wayback) in place of the base map, with a panel to go through
 * the dates when the imagery under the map's center changed
 */
export const Wayback: React.FC<WaybackProps> = ({ onClose }) => {
    const { t } = useTranslation()

    const panelRef = useRef<HTMLDivElement>(null)
    const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

    const [tile, setTile] = useState<WaybackTile>()
    const [chosen, setChosen] = useState<WaybackRelease>()
    // The imagery on the screen: it stays under the next one until all the next one's tiles are loaded,
    // so switching the date does not blink white
    const [shownUrl, setShownUrl] = useState<string>(CURRENT_IMAGERY_URL)

    const map = useMapEvents({
        moveend: () => {
            clearTimeout(timerRef.current)
            timerRef.current = setTimeout(updateTile, DEBOUNCE_MS)
        }
    })

    const updateTile = () => {
        const center = map.getCenter()
        const next = centerTile(center.lat, center.lng, map.getZoom())

        setTile((prev) => (prev?.x === next.x && prev.y === next.y && prev.z === next.z ? prev : next))
    }

    useEffect(() => {
        updateTile()

        return () => clearTimeout(timerRef.current)
    }, [])

    useEffect(() => {
        if (panelRef.current) {
            Leaflet.DomEvent.disableClickPropagation(panelRef.current)
            Leaflet.DomEvent.disableScrollPropagation(panelRef.current)
        }
    }, [])

    const { changes, isFetching, isError } = useLocalChanges(tile)

    // Oldest first: the slider goes from the past on the left to today on the right
    const releases = [...changes].reverse()
    const current = pickRelease(changes, chosen)
    const index = current ? releases.indexOf(current) : -1

    const targetUrl = current ? WAYBACK_TILE_URL.replace('{release}', String(current.id)) : CURRENT_IMAGERY_URL
    const layerUrls = targetUrl === shownUrl ? [shownUrl] : [shownUrl, targetUrl]

    const choose = (position: number) => {
        const release = releases[position]

        if (release) {
            setChosen(release)
        }
    }

    return (
        <>
            {layerUrls.map((url, order) => (
                <FallbackTileLayer
                    // By url: the loaded layer stays the same Leaflet layer when it becomes the shown one
                    key={url}
                    attribution={'&copy; Esri World Imagery Wayback'}
                    url={url}
                    zIndex={order + 1}
                    maxNativeZoom={19}
                    maxZoom={19}
                    eventHandlers={url === shownUrl ? undefined : { load: () => setShownUrl(url) }}
                />
            ))}

            <div
                ref={panelRef}
                className={styles.panel}
            >
                <div className={styles.header}>
                    <b>{t('wayback_title', { defaultValue: 'Снимки прошлых лет' })}</b>
                    {isFetching && <Spinner className={styles.spinner} />}
                    <button
                        type={'button'}
                        className={styles.close}
                        aria-label={t('wayback_close', { defaultValue: 'Выключить снимки прошлых лет' })}
                        title={t('wayback_close', { defaultValue: 'Выключить снимки прошлых лет' })}
                        onClick={onClose}
                    >
                        {'✕'}
                    </button>
                </div>

                {isError ? (
                    <div className={styles.error}>
                        {t('wayback_error', { defaultValue: 'Не удалось загрузить архив снимков' })}
                    </div>
                ) : !current ? (
                    <div className={styles.hint}>
                        {t('wayback_loading', { defaultValue: 'Ищем снимки этого места…' })}
                    </div>
                ) : (
                    <>
                        <div className={styles.dateRow}>
                            <button
                                type={'button'}
                                className={styles.step}
                                disabled={index <= 0}
                                aria-label={t('wayback_older', { defaultValue: 'Более старый снимок' })}
                                title={t('wayback_older', { defaultValue: 'Более старый снимок' })}
                                onClick={() => choose(index - 1)}
                            >
                                <Icon name={'KeyboardLeft'} />
                            </button>
                            <div className={styles.date}>{formatDate(current.date, 'D MMMM YYYY')}</div>
                            <button
                                type={'button'}
                                className={styles.step}
                                disabled={index >= releases.length - 1}
                                aria-label={t('wayback_newer', { defaultValue: 'Более новый снимок' })}
                                title={t('wayback_newer', { defaultValue: 'Более новый снимок' })}
                                onClick={() => choose(index + 1)}
                            >
                                <Icon name={'KeyboardRight'} />
                            </button>
                        </div>

                        {releases.length > 1 && (
                            <>
                                <input
                                    type={'range'}
                                    className={styles.slider}
                                    min={0}
                                    max={releases.length - 1}
                                    step={1}
                                    value={index}
                                    aria-label={t('wayback_date', { defaultValue: 'Дата снимка' })}
                                    aria-valuetext={formatDate(current.date, 'D MMMM YYYY')}
                                    onChange={(event) => choose(Number(event.target.value))}
                                />
                                <div className={styles.years}>
                                    <span>{releases[0].date.slice(0, 4)}</span>
                                    <span>{releases[releases.length - 1].date.slice(0, 4)}</span>
                                </div>
                            </>
                        )}

                        <div className={styles.hint}>
                            {t('wayback_versions', {
                                defaultValue: 'Версий снимка в центре карты: {{value}}',
                                value: releases.length
                            })}
                        </div>
                    </>
                )}

                <div className={styles.attribution}>{'Esri World Imagery Wayback'}</div>
            </div>
        </>
    )
}
