import React, { useMemo } from 'react'
import { Container } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'

import { ApiType } from '@/api'
import type { QuestPointMark, QuestZoneMark } from '@/components/map/types'
import { questBounds } from '@/utils/game'

import styles from './styles.module.sass'

const InteractiveMap = dynamic(() => import('@/components/map/InteractiveMap'), { ssr: false })

// Stable reference: InteractiveMap refits when the options object changes
const BOUNDS_OPTIONS = { maxZoom: 16, padding: [40, 40] as [number, number] }

interface QuestMapProps {
    points: ApiType.Game.QuestPoint[]
    /** A riddle quest's search zone: the circle where all its points are */
    zone?: ApiType.Game.QuestZone
}

/**
 * The map of a quest: the points the walker has opened, numbered (a confirmed one as its
 * place's category icon), with a dashed line through
 * them (`QuestLayer`), fitted to all of them. A closed step or an unsolved riddle is not on
 * the map — the API does not send its place. A riddle quest has its search zone, a dashed
 * circle that holds every point, from the start: the map is fitted to it, so it is shown
 * before the first answer too. Renders nothing with neither a point nor a zone.
 */
export const QuestMap: React.FC<QuestMapProps> = ({ points, zone }) => {
    const marks = useMemo<QuestPointMark[]>(
        () =>
            points
                .filter((point) => !!point.place)
                .map((point) => ({
                    category: point.place!.category,
                    id: point.id,
                    label: String(point.position),
                    lat: Number(point.place!.lat),
                    lon: Number(point.place!.lon),
                    state: point.state === 'locked' ? 'open' : point.state,
                    title: point.place!.title
                })),
        [points]
    )

    const zones = useMemo<QuestZoneMark[]>(() => (zone ? [{ id: 'zone', ...zone }] : []), [zone])

    const bounds = useMemo(() => questBounds(marks, zones), [marks, zones])

    if (!marks.length && !zones.length) {
        return null
    }

    return (
        <Container className={styles.map}>
            <div className={styles.mapInner}>
                <InteractiveMap
                    // Refitted when a new point opens
                    key={marks.length}
                    quest={marks}
                    questZones={zones}
                    center={bounds ? undefined : [marks[0].lat, marks[0].lon]}
                    zoom={bounds ? undefined : 15}
                    bounds={bounds}
                    boundsOptions={BOUNDS_OPTIONS}
                    scrollWheelZoom={false}
                    controlsSize={'small'}
                    enableFullScreen={true}
                    enableUserLocation={true}
                    enableCategoryControl={false}
                    enableLayersSwitcher={false}
                    enableContextMenu={false}
                />
            </div>
        </Container>
    )
}
