import React from 'react'
import { TFunction } from 'i18next'
import { Icon, Tooltip } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { formatDate } from '@/utils/helpers'

import { Award } from './useUserAwards'

import styles from './styles.module.sass'

/** Of a long description, the tooltip keeps the start */
const NOTE_LENGTH = 90

/** The second line of a hexagon's tooltip: the place in a season, the day a quest was walked, an achievement's description */
export const awardNote = (award: Award, t: TFunction): string | undefined => {
    if (award.season?.place) {
        return t('user-side-game-season-place', { place: award.season.place })
    }

    if (award.quest?.walk?.finished) {
        return t('user-side-awards-quest-walked', { date: formatDate(award.quest.walk.finished, 'D MMMM YYYY') })
    }

    // What the step shown asks: the highest earned, or the first one of a locked achievement
    const group = award.group
    const description = (group?.achieved ?? group?.steps[0])?.description

    return description && description.length > NOTE_LENGTH
        ? `${description.slice(0, NOTE_LENGTH).trimEnd()}…`
        : description || undefined
}

interface AwardButtonProps {
    award: Award
    size: number
    onOpen: (award: Award) => void
}

interface AwardPictureProps {
    award: Award
    size: number
}

interface LockedMedalProps {
    /** The height of the medal: the lock is a part of it */
    size: number
    children: React.ReactNode
}

/**
 * A medal not earned yet: grey and faint under a lock in the middle of the hexagon — the one
 * look of a locked award or step wherever it is shown
 */
export const LockedMedal: React.FC<LockedMedalProps> = ({ size, children }) => (
    <span
        className={styles.lockedPicture}
        style={{ '--award-size': `${size}px` } as React.CSSProperties}
    >
        <span className={styles.lockedMedal}>{children}</span>
        <span className={styles.lock}>
            <Icon name={'Lock'} />
        </span>
    </span>
)

/** The picture of an award at a size, under a lock when it is not earned yet */
export const AwardPicture: React.FC<AwardPictureProps> = ({ award, size }) =>
    award.locked ? <LockedMedal size={size}>{award.picture(size)}</LockedMedal> : <>{award.picture(size)}</>

/** A hexagon of an award: its name in a tooltip, the award's card on a click */
export const AwardButton: React.FC<AwardButtonProps> = ({ award, size, onOpen }) => {
    const { t } = useTranslation()
    const note = awardNote(award, t)

    return (
        <Tooltip
            content={
                <>
                    <div>
                        <strong>{award.title}</strong>
                    </div>
                    {note && <div>{note}</div>}
                </>
            }
        >
            <button
                type={'button'}
                className={styles.award}
                aria-label={note ? `${award.title}, ${note}` : award.title}
                onClick={() => onOpen(award)}
            >
                <AwardPicture
                    award={award}
                    size={size}
                />
            </button>
        </Tooltip>
    )
}

interface AwardMoreProps {
    /** The awards the row does not hold; 0 — all fit, "···" only opens them larger */
    hidden: number
    /** The first award the row does not hold, seen through the plate */
    under?: React.ReactNode
    onClick: () => void
}

/** The last cell of the showcase: the next award under a grey hexagon "+N" that opens every award */
export const AwardMore: React.FC<AwardMoreProps> = ({ hidden, under, onClick }) => {
    const { t } = useTranslation()
    const label = t('user-awards-all')

    return (
        <Tooltip content={label}>
            <button
                type={'button'}
                className={styles.more}
                aria-label={hidden ? `${label}: ${t('user-awards-more', { count: hidden })}` : label}
                onClick={onClick}
            >
                {under && (
                    <span
                        className={styles.moreUnder}
                        aria-hidden={true}
                    >
                        {under}
                    </span>
                )}
                <span className={styles.morePlate}>{hidden ? `+${hidden}` : '···'}</span>
            </button>
        </Tooltip>
    )
}
