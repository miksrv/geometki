import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMapEvents } from 'react-leaflet'
import Leaflet from 'leaflet'
import { Button } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { useAppSelector } from '@/app/store'
import { Counter } from '@/components/ui'
import { MOBILE_MAX_WIDTH } from '@/config/constants'

import { roundBoundsOutwards } from '../bounds'
import { MapControlsContext } from '../MapControlsContext'
import { getMapSettings, saveMapSettings } from '../mapSettings'

import { CandidateMarker } from './CandidateMarker'
import {
    DEFAULT_GROUPS,
    GROUP_COLORS,
    GROUPS,
    OSM_CANDIDATES_DEBOUNCE_MS,
    OSM_CANDIDATES_MIN_ZOOM,
    OSM_CANDIDATES_POLLING_MS,
    useGroupHints,
    useGroupTitles
} from './constants'
import { CandidateGroup, candidateGroup, displayName } from './utils'

import styles from './styles.module.sass'

/** On a phone the open legend covers too much of the map: collapsed until the user opens it */
const isNarrowScreen = (): boolean =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches

/**
 * Map layer with interesting OSM objects that are not on Geometki yet, and its legend.
 * The candidates come from our API; the areas that were never collected are collected in the background.
 */
export const OsmCandidates: React.FC = React.memo(function OsmCandidates() {
    const { t, i18n } = useTranslation()
    const groupTitles = useGroupTitles()
    const groupHints = useGroupHints()

    const panelRef = useRef<HTMLDivElement>(null)
    const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

    const isAdmin = useAppSelector((state) => state.auth.user?.role) === 'admin'
    const { bottomSlot } = useContext(MapControlsContext)

    const [bounds, setBounds] = useState<string>()
    const [zoomTooSmall, setZoomTooSmall] = useState(false)
    // Rendered on the client only, inside the map, so the saved state is read right away
    const [collapsed, setCollapsed] = useState(() => getMapSettings().osmCandidatesCollapsed ?? isNarrowScreen())
    const [visible, setVisible] = useState<CandidateGroup[]>(DEFAULT_GROUPS)
    // Poll only while the area is being collected in the background. Through the state: the
    // interval is an argument of the query hook, so it cannot be computed from the hook's result
    const [pollingInterval, setPollingInterval] = useState(0)

    const map = useMapEvents({
        moveend: () => {
            clearTimeout(timerRef.current)
            timerRef.current = setTimeout(updateBounds, OSM_CANDIDATES_DEBOUNCE_MS)
        }
    })

    const updateBounds = () => {
        const tooSmall = map.getZoom() < OSM_CANDIDATES_MIN_ZOOM

        setZoomTooSmall(tooSmall)
        setBounds(tooSmall ? undefined : roundBoundsOutwards(map.getBounds()).join(','))
    }

    const { data, isFetching, isError } = API.useOsmCandidatesGetListQuery(
        // All tiers at once: the legend shows the counts of the hidden groups too
        { bounds: bounds ?? '', tiers: 'known,explore,other' },
        { pollingInterval, skip: !bounds, skipPollingIfUnfocused: true }
    )

    const pending = !!data?.pendingTiles

    useEffect(() => {
        setPollingInterval(pending ? OSM_CANDIDATES_POLLING_MS : 0)
    }, [pending])

    useEffect(() => {
        updateBounds()

        return () => clearTimeout(timerRef.current)
    }, [])

    useEffect(() => {
        if (panelRef.current) {
            Leaflet.DomEvent.disableClickPropagation(panelRef.current)
            Leaflet.DomEvent.disableScrollPropagation(panelRef.current)
        }
    }, [collapsed, bottomSlot])

    const groups = isAdmin ? GROUPS : GROUPS.filter((group) => group !== 'onsite')

    const counts = useMemo(() => {
        const result: Record<CandidateGroup, number> = { explore: 0, known: 0, onsite: 0, other: 0 }

        data?.items.forEach((item) => result[candidateGroup(item)]++)

        return result
    }, [data])

    // Grey and blue first, so the main groups are drawn on top
    const items = useMemo(
        () =>
            (bounds ? (data?.items ?? []) : [])
                .map((item) => ({ group: candidateGroup(item), item }))
                .filter(({ group }) => visible.includes(group))
                .sort((a, b) => Number(DEFAULT_GROUPS.includes(a.group)) - Number(DEFAULT_GROUPS.includes(b.group)))
                .map(({ group, item }) => ({
                    group,
                    item,
                    title: isAdmin
                        ? `${item.score} · ${displayName(t, item, i18n.language)}`
                        : displayName(t, item, i18n.language)
                })),
        [data, visible, bounds, isAdmin, t, i18n.language]
    )

    const newPlacesCount = counts.known + counts.explore

    const handleCollapse = (value: boolean) => {
        setCollapsed(value)
        saveMapSettings({ osmCandidatesCollapsed: value })
    }

    const toggle = (group: CandidateGroup) =>
        setVisible((prev) => (prev.includes(group) ? prev.filter((item) => item !== group) : [...prev, group]))

    const panel = (
        <div
            ref={panelRef}
            className={bottomSlot ? undefined : styles.panelWrapper}
        >
            {collapsed ? (
                // Same square button as the other map controls, with the AppBar bell's counter
                <span className={styles.collapsedTrigger}>
                    <Button
                        className={styles.collapsedButton}
                        mode={'secondary'}
                        icon={'Compass'}
                        aria-label={t('osm-candidates_title', { defaultValue: 'Места для исследования' })}
                        tooltip={t('osm-candidates_title', { defaultValue: 'Места для исследования' })}
                        onClick={() => handleCollapse(false)}
                    />
                    {!zoomTooSmall && newPlacesCount > 0 && (
                        <Counter
                            className={styles.collapsedCounter}
                            value={newPlacesCount}
                            max={99}
                        />
                    )}
                </span>
            ) : (
                <div className={styles.panel}>
                    <div className={styles.header}>
                        <b>{t('osm-candidates_title', { defaultValue: 'Места для исследования' })}</b>
                        <button
                            type={'button'}
                            className={styles.close}
                            aria-label={t('osm-candidates_collapse', { defaultValue: 'Свернуть' })}
                            title={t('osm-candidates_collapse', { defaultValue: 'Свернуть' })}
                            onClick={() => handleCollapse(true)}
                        >
                            {'✕'}
                        </button>
                    </div>

                    {zoomTooSmall || data?.tooLarge ? (
                        <div className={styles.stats}>
                            {t('osm-candidates_zoom-in', { defaultValue: 'Приблизьте карту' })}
                        </div>
                    ) : isError ? (
                        <div className={styles.error}>
                            {t('osm-candidates_error', { defaultValue: 'Не удалось загрузить места' })}
                        </div>
                    ) : (
                        <div className={styles.stats}>
                            {isFetching && !data
                                ? t('osm-candidates_loading', { defaultValue: 'Ищем места…' })
                                : t('osm-candidates_found', {
                                      defaultValue: 'Найдено мест: {{value}}',
                                      value: counts.known + counts.explore + counts.other
                                  })}
                        </div>
                    )}

                    {pending && !zoomTooSmall && (
                        <div className={styles.stats}>
                            {t('osm-candidates_collecting', { defaultValue: 'Собираем данные…' })}
                        </div>
                    )}

                    {groups.map((group) => (
                        <label
                            key={group}
                            title={groupHints[group]}
                        >
                            <input
                                type={'checkbox'}
                                checked={visible.includes(group)}
                                onChange={() => toggle(group)}
                            />
                            <span
                                className={styles.dot}
                                style={{ background: GROUP_COLORS[group] }}
                            />
                            {`${groupTitles[group]}: ${counts[group]}`}
                        </label>
                    ))}

                    <div className={styles.attribution}>{'© OpenStreetMap contributors'}</div>
                </div>
            )}
        </div>
    )

    return (
        <>
            {/* In the map's bottom-left slot above the coordinates; on its own corner without the slot */}
            {bottomSlot ? createPortal(panel, bottomSlot) : panel}

            {items.map(({ group, item, title }) => (
                <CandidateMarker
                    key={item.id}
                    candidate={item}
                    group={group}
                    title={title}
                    isAdmin={isAdmin}
                />
            ))}
        </>
    )
})
