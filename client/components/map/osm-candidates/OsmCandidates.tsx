import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useMapEvents } from 'react-leaflet'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel } from '@/api'

import { CandidateMarker } from './CandidateMarker'
import { OSM_CANDIDATES_DEBOUNCE_MS, OSM_CANDIDATES_MIN_ZOOM, OSM_CANDIDATES_POLLING_MS } from './constants'
import { candidatesBounds, displayName } from './utils'

/**
 * Map layer with interesting OSM objects that are not on Geometki yet ("undiscovered places"). The
 * candidates come from our API; the areas that were never collected are collected in the background.
 * The same quiet layer for everybody: only the ghost markers, no panel, nothing to switch.
 */
interface OsmCandidatesProps {
    /** The map's category filter: undefined or empty is all; the ghosts follow it like the place markers */
    categories?: ApiModel.Categories[]
}

export const OsmCandidates: React.FC<OsmCandidatesProps> = React.memo(function OsmCandidates({ categories }) {
    const { t, i18n } = useTranslation()

    const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

    const [bounds, setBounds] = useState<string>()
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

        setBounds(tooSmall ? undefined : candidatesBounds(map.getBounds()))
    }

    const { data } = API.useOsmCandidatesGetListQuery(
        { bounds: bounds ?? '', tiers: 'known,explore' },
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

    const items = useMemo(() => {
        const shown = categories?.length ? new Set<string>(categories) : undefined

        return (bounds ? (data?.items ?? []) : [])
            .filter(
                (item) =>
                    item.status === 'open' &&
                    (item.tier === 'known' || item.tier === 'explore') &&
                    (!shown || (!!item.category && shown.has(item.category)))
            )
            .map((item) => ({ item, title: displayName(t, item, i18n.language) }))
    }, [data, bounds, categories, t, i18n.language])

    return (
        <>
            {items.map(({ item, title }) => (
                <CandidateMarker
                    key={item.id}
                    candidate={item}
                    title={title}
                />
            ))}
        </>
    )
})
