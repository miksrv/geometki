import React from 'react'
import { Marker, Popup, Tooltip } from 'react-leaflet'
import Leaflet from 'leaflet'
import { Skeleton } from 'simple-react-ui-kit'

import { API, ApiType } from '@/api'
import { QuestCard } from '@/components/shared/quest-card'

import styles from './styles.module.sass'

// A white flag on the pole: a quest begins here (a 20px viewBox, the place icons' size)
const FLAG =
    '<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">' +
    '<path d="M6.5 4.5v11" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>' +
    '<path d="M7.5 4.5h7l-1.8 2.75 1.8 2.75h-7z" fill="#fff"/></svg>'

// A riddle quest: its places are the answers, the mark is the middle of where to look
const RIDDLE =
    '<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">' +
    '<text x="10" y="15" text-anchor="middle" font-size="14" font-weight="700" font-family="system-ui, sans-serif" fill="#fff">?</text></svg>'

/**
 * A quest's mark, made like the place markers: the same 20px rounded square with the thin
 * white frame, in the brand blue with a white flag (a riddle quest: a question mark) in place of
 * a category picture. One icon per glyph, shared by all the marks.
 */
const icons = new Map<string, Leaflet.DivIcon>()

const questIcon = (mode: ApiType.Game.QuestMode): Leaflet.DivIcon => {
    const key = mode === 'riddles' ? 'riddle' : 'flag'
    let icon = icons.get(key)

    if (!icon) {
        icon = Leaflet.divIcon({
            className: styles.questMark,
            html: mode === 'riddles' ? RIDDLE : FLAG,
            // As the place markers: the centre is the point, the hint starts a little above
            iconAnchor: [10, 10],
            iconSize: [20, 20],
            popupAnchor: [0, -10],
            tooltipAnchor: [0, -12]
        })
        icons.set(key, icon)
    }

    return icon
}

interface QuestMarkerProps {
    mark: ApiType.Game.QuestMark
}

/** The card of a quest in its mark's popup, loaded when the popup opens */
const QuestPopupCard: React.FC<{ id: string }> = ({ id }) => {
    const { data } = API.useQuestsGetItemQuery({ id })

    return data ? (
        <QuestCard
            quest={data}
            headingLevel={3}
            sizes={'280px'}
            className={styles.card}
        />
    ) : (
        <div className={styles.loading}>
            <Skeleton />
        </div>
    )
}

/**
 * One quest on a map: the pin with its name on hover; a click opens the popup with the quest's
 * card (`QuestCard`, the same as in the quests' list), loaded then — the marks carry only what
 * the map needs. Memoized: a re-render of the map does not move every marker again.
 */
export const QuestMarker = React.memo<QuestMarkerProps>(({ mark }) => {
    const [opened, setOpened] = React.useState(false)

    return (
        <Marker
            position={[mark.lat, mark.lon]}
            icon={questIcon(mark.mode)}
            eventHandlers={{ popupopen: () => setOpened(true) }}
        >
            <Tooltip direction={'top'}>
                <span className={'mapHint'}>{mark.title}</span>
            </Tooltip>
            <Popup
                className={styles.questPopup}
                maxWidth={300}
                minWidth={280}
                autoPanPadding={[16, 16]}
            >
                {opened && <QuestPopupCard id={mark.id} />}
            </Popup>
        </Marker>
    )
})

QuestMarker.displayName = 'QuestMarker'

interface QuestMarksProps {
    /** The quests to show; without them, every quest of the site (the "Квесты" layer of the maps) */
    marks?: ApiType.Game.QuestMark[]
}

/** The quests on a map: the given ones, or the layer of all of them, loaded once */
export const QuestMarks: React.FC<QuestMarksProps> = ({ marks }) => {
    const { data } = API.useQuestsGetMarksQuery(undefined, { skip: !!marks })

    return (
        <>
            {(marks ?? data?.items)?.map((mark) => (
                <QuestMarker
                    key={mark.id}
                    mark={mark}
                />
            ))}
        </>
    )
}
