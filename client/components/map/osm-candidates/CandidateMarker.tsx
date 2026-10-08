import React, { useMemo } from 'react'
import { CircleMarker, Popup, Tooltip } from 'react-leaflet'
import type { PathOptions } from 'leaflet'

import { ApiType } from '@/api'

import { CandidatePopup } from './CandidatePopup'
import { GROUP_COLORS, GROUPS } from './constants'
import { CandidateGroup } from './utils'

import styles from './styles.module.sass'

// One options object per group: react-leaflet restyles the circle when it gets a new object
const PATH_OPTIONS = Object.fromEntries(
    GROUPS.map((group) => [group, { color: '#fff', fillColor: GROUP_COLORS[group], fillOpacity: 0.9, weight: 1.5 }])
) as Record<CandidateGroup, PathOptions>

const markerRadius = (candidate: ApiType.OsmCandidates.Candidate, group: CandidateGroup): number =>
    group === 'known' || group === 'explore' ? Math.min(14, 6 + Math.max(0, candidate.score) / 2) : 5

interface CandidateMarkerProps {
    candidate: ApiType.OsmCandidates.Candidate
    group: CandidateGroup
    /** The tooltip text, made by the parent for all markers at once */
    title: string
    isAdmin: boolean
}

/**
 * One candidate on the map. Memoized with stable `center` and `pathOptions`, so that a re-render
 * of the layer (a map move, a new list) does not move and restyle every circle again
 */
export const CandidateMarker = React.memo<CandidateMarkerProps>(({ candidate, group, title, isAdmin }) => {
    const center = useMemo<[number, number]>(() => [candidate.lat, candidate.lon], [candidate.lat, candidate.lon])

    return (
        <CircleMarker
            center={center}
            radius={markerRadius(candidate, group)}
            pathOptions={PATH_OPTIONS[group]}
        >
            <Tooltip direction={'top'}>{title}</Tooltip>
            <Popup
                className={styles.candidatePopup}
                maxWidth={320}
                autoPanPadding={[16, 16]}
            >
                <CandidatePopup
                    candidate={candidate}
                    isAdmin={isAdmin}
                />
            </Popup>
        </CircleMarker>
    )
})

CandidateMarker.displayName = 'CandidateMarker'
