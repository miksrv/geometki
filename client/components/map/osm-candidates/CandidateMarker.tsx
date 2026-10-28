import React, { useMemo } from 'react'
import { Marker, Popup, Tooltip } from 'react-leaflet'
import Leaflet from 'leaflet'

import { ApiModel, ApiType } from '@/api'
import { categoryImage } from '@/utils/categories'

import { CandidatePopup } from './CandidatePopup'

import styles from './styles.module.sass'

/**
 * A white spot: the ghost of a place marker — the same 20px square with the icon of
 * the candidate's category, the whole marker faded — so it reads as "a place like the
 * others, not here yet" without catching the eye. One icon per category, shared by all its markers
 */
const ghostIcons = new Map<string, Leaflet.DivIcon>()

const ghostIcon = (category: string | null): Leaflet.DivIcon => {
    const key = category ?? ''
    let icon = ghostIcons.get(key)

    if (!icon) {
        icon = Leaflet.divIcon({
            className: styles.whiteSpot,
            html: `<img src="${categoryImage((category ?? undefined) as ApiModel.Categories | undefined).src}" alt="" />`,
            iconAnchor: [10, 10],
            iconSize: [20, 20],
            // The hint starts a little above the icon, as on the place markers
            tooltipAnchor: [0, -12]
        })
        ghostIcons.set(key, icon)
    }

    return icon
}

interface CandidateMarkerProps {
    candidate: ApiType.OsmCandidates.Candidate
    /** The tooltip text, made by the parent for all markers at once */
    title: string
}

/**
 * One candidate on the map: the ghost of a place marker. Memoized with a stable `position`, so that
 * a re-render of the layer (a map move, a new list) does not move every marker again
 */
export const CandidateMarker = React.memo<CandidateMarkerProps>(({ candidate, title }) => {
    const center = useMemo<[number, number]>(() => [candidate.lat, candidate.lon], [candidate.lat, candidate.lon])

    return (
        <Marker
            position={center}
            icon={ghostIcon(candidate.category)}
        >
            <Tooltip direction={'top'}>
                <span className={'mapHint'}>{title}</span>
            </Tooltip>
            <Popup
                className={styles.candidatePopup}
                maxWidth={320}
                autoPanPadding={[16, 16]}
            >
                <CandidatePopup candidate={candidate} />
            </Popup>
        </Marker>
    )
})

CandidateMarker.displayName = 'CandidateMarker'
