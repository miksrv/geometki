import React, { useMemo } from 'react'
import { cn, Container } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'

import { ApiType } from '@/api'
import { questBounds } from '@/utils/game'

import styles from './styles.module.sass'

const InteractiveMap = dynamic(() => import('@/components/map/InteractiveMap'), { ssr: false })

// Stable reference: InteractiveMap refits when the options object changes
const BOUNDS_OPTIONS = { maxZoom: 14, padding: [48, 48] as [number, number] }

interface QuestsMapProps {
    /** The quests of the page */
    quests: ApiType.Game.Quest[]
    className?: string
}

/**
 * The map over the quests' list: the quests of the page as the pins of the quests' layer —
 * a click opens the quest's card in a popup. A quest is at its start; a riddle quest is not on
 * the map (its zone is drawn on its own page only).
 */
export const QuestsMap: React.FC<QuestsMapProps> = ({ quests, className }) => {
    const marks = useMemo<ApiType.Game.QuestMark[]>(
        () =>
            quests.flatMap((quest) => {
                // A riddle quest has no start: it is not on the maps
                const { start } = quest

                return start ? [{ id: quest.id, mode: quest.mode, slug: quest.slug, title: quest.title, ...start }] : []
            }),
        [quests]
    )

    const bounds = useMemo(() => questBounds(marks), [marks])

    if (!marks.length) {
        return null
    }

    return (
        <Container className={cn(styles.map, className)}>
            <div className={styles.mapInner}>
                <InteractiveMap
                    // Refitted when the page changes
                    key={marks.map(({ id }) => id).join()}
                    quests={marks}
                    center={bounds ? undefined : [marks[0].lat, marks[0].lon]}
                    zoom={bounds ? undefined : 14}
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
