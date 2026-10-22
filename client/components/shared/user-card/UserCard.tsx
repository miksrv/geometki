import React from 'react'
import { cn, Icon, IconTypes } from 'simple-react-ui-kit'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { Reputation } from '@/components/ui'
import { IMG_HOST } from '@/config/env'
import useClientOnly from '@/hooks/useClientOnly'
import { getCategoryTitle, isCategoryName } from '@/utils/categories'
import { buildPlaceUrl, formatDate, formatThousands, minutesAgo, timeAgo } from '@/utils/helpers'
import { levelColor, levelProgress, levelTier } from '@/utils/levels'

import { CategoryIcon } from '../category-icon'
import { LevelBadge } from '../level-badge/LevelBadge'
import { UserAvatar } from '../user-avatar'

import styles from './styles.module.sass'

/** Covers in the strip of a tile: the newest places, the last one turns into "+N" */
export const USER_CARD_PLACES = 4

/** A user counts as online for this long after their last request (the avatar's green mark) */
const ONLINE_MINUTES = 15

export type UserCardVariant = 'tile' | 'row'

export interface UserCardProps {
    user: ApiModel.User
    /** `tile` — the people list grid (a line on phones); `row` — a dense line inside another block */
    variant?: UserCardVariant
    /** The place in a ranking, `tile` only: shown where the list is one (sorted by experience or reputation) */
    rank?: number
    /** 2 by default, 3 inside another titled block */
    headingLevel?: 2 | 3
    className?: string
}

/**
 * The one card of a person (DESIGN.md → Cards → UserCard): the avatar and the name, when
 * they were last here, the level, and — on a tile — the covers of their newest places and
 * the counts of their places, photos and visits. The whole card opens the profile (the name
 * link is stretched over it); the covers and the counts lead to the profile tabs.
 */
export const UserCard: React.FC<UserCardProps> = ({ user, variant = 'tile', rank, headingLevel = 2, className }) => {
    const { t, i18n } = useTranslation()
    // The list HTML is cached (the guest API cache, the home page ISR): "5 minutes ago" is the browser's
    const isClient = useClientOnly()

    const Heading = headingLevel === 3 ? 'h3' : 'h2'
    const profileHref = `/users/${user.id}`
    const level = user.levelData?.level
    const isOnline = isClient && !!user.activity?.date && minutesAgo(user.activity.date) <= ONLINE_MINUTES

    // Nothing before hydration: the server render carries no time, the line keeps its height in CSS
    const lastSeen = !isClient ? null : isOnline ? (
        <span className={styles.online}>{t('user-card-online', 'на сайте')}</span>
    ) : user.activity?.date ? (
        timeAgo(user.activity.date, undefined, i18n.language)
    ) : null

    const avatar = (
        <UserAvatar
            user={user}
            size={variant === 'tile' ? 'large' : 'medium'}
            disableLink={true}
        />
    )

    const name = (
        <Heading className={styles.name}>
            <Link
                href={profileHref}
                className={styles.nameLink}
                title={user.name}
            >
                {user.name}
            </Link>
        </Heading>
    )

    if (variant === 'row') {
        return (
            <article className={cn(styles.card, styles.row, className)}>
                {avatar}
                <div className={styles.who}>
                    {name}
                    <p
                        className={styles.sub}
                        suppressHydrationWarning={true}
                    >
                        {lastSeen}
                    </p>
                </div>
                <LevelBadge
                    level={level}
                    size={22}
                />
                <Reputation value={user.reputation ?? 0} />
            </article>
        )
    }

    const progress = levelProgress(user.levelData)
    const since = user.created?.date ? formatDate(user.created.date, 'YYYY') : undefined
    const placesCount = Math.max(user.statistic?.place ?? 0, user.places?.length ?? 0)

    return (
        <article className={cn(styles.card, styles.tile, className)}>
            {!!rank && (
                <span
                    className={cn(styles.rank, rank <= 3 && styles.top)}
                    title={t('user-card-rank', 'Место в рейтинге: {{rank}}', { rank })}
                >
                    {`#${rank}`}
                </span>
            )}

            <div className={styles.head}>
                {avatar}
                <div className={styles.who}>
                    {name}
                    <p
                        className={styles.sub}
                        suppressHydrationWarning={true}
                    >
                        {lastSeen}
                        {lastSeen && since ? ' · ' : ''}
                        {since ? t('user-card-since', 'с {{year}} года', { year: since }) : ''}
                    </p>
                </div>
            </div>

            <div className={styles.level}>
                <LevelBadge
                    level={level}
                    size={28}
                />
                <div className={styles.levelText}>
                    <div className={styles.levelRow}>
                        <span className={styles.tier}>{t(`levelTier.${levelTier(level)}`)}</span>
                        <span className={styles.experience}>
                            {progress.isMaxLevel
                                ? formatThousands(user.levelData?.experience ?? 0)
                                : `${formatThousands(progress.gained)} / ${formatThousands(progress.required ?? 0)}`}
                        </span>
                    </div>
                    <div className={styles.progressBar}>
                        <div
                            className={styles.progressFill}
                            style={{ backgroundColor: levelColor(level), width: `${progress.percent}%` }}
                        />
                    </div>
                </div>
            </div>

            {user.places && (
                <UserCardPlaces
                    userId={user.id}
                    places={user.places}
                    count={placesCount}
                />
            )}

            <div className={styles.stats}>
                <UserCardStat
                    href={`${profileHref}/places`}
                    icon={'Point'}
                    value={placesCount}
                    unit={t('user-card-places', { count: placesCount })}
                />
                <UserCardStat
                    href={`${profileHref}/photos`}
                    icon={'Camera'}
                    value={user.statistic?.photo ?? 0}
                    unit={t('user-card-photos', { count: user.statistic?.photo ?? 0 })}
                />
                <UserCardStat
                    href={`${profileHref}/visited`}
                    icon={'CheckCircle'}
                    value={user.statistic?.visited ?? 0}
                    unit={t('user-card-visited', { count: user.statistic?.visited ?? 0 })}
                />
                <span
                    className={styles.reputation}
                    title={t('reputation', 'Репутация')}
                >
                    <Reputation value={user.reputation ?? 0} />
                </span>
            </div>
        </article>
    )
}

interface UserCardStatProps {
    href: string
    icon: IconTypes
    value: number
    /** The word after the number, in the number's form: "мест", "фото", "посещено" */
    unit: string
}

/** One count of a tile: an icon, the number and what it counts, a link to that tab of the profile */
const UserCardStat: React.FC<UserCardStatProps> = ({ href, icon, value, unit }) => (
    <Link
        href={href}
        className={styles.stat}
    >
        <Icon
            name={icon}
            aria-hidden={true}
        />
        <span>
            <b>{formatThousands(value)}</b> {unit}
        </span>
    </Link>
)

interface UserCardPlacesProps {
    userId: string
    places: ApiModel.UserPlacePreview[]
    /** All the user's places: the last cover says how many more there are */
    count: number
}

/** The strip of covers of a person's newest places; hidden on phones */
const UserCardPlaces: React.FC<UserCardPlacesProps> = ({ userId, places, count }) => {
    const { t } = useTranslation()
    const placesHref = `/users/${userId}/places`

    if (!places.length) {
        return count > 0 ? (
            <Link
                href={placesHref}
                className={styles.placesNone}
            >
                {t('places-count', '{{count}} мест', { count })}
            </Link>
        ) : (
            <p className={styles.placesNone}>{t('user-card-no-places', 'Пока без мест')}</p>
        )
    }

    const shown = places.slice(0, USER_CARD_PLACES)
    const more = count > USER_CARD_PLACES ? count - (USER_CARD_PLACES - 1) : 0

    return (
        <ul className={styles.places}>
            {shown.map((place, index) => {
                const isMore = more > 0 && index === USER_CARD_PLACES - 1
                // A retired or missing key has no icon of its own: no icon then
                const category = isCategoryName(place.category) ? place.category : undefined
                // A place without a text in any locale is named by its category
                const name = place.title || (category ? getCategoryTitle(t, category) : place.id)

                return (
                    <li key={place.id}>
                        <Link
                            href={isMore ? placesHref : buildPlaceUrl(place.id, place.slug)}
                            className={cn(styles.placeLink, isMore && styles.more)}
                            title={isMore ? undefined : name}
                            aria-label={isMore ? t('user-card-all-places', 'Все места: {{count}}', { count }) : name}
                        >
                            <Image
                                src={`${IMG_HOST}${place.cover.preview}`}
                                alt={''}
                                fill
                                quality={50}
                                sizes={'120px'}
                                className={styles.placeImage}
                            />
                            {isMore ? (
                                <span className={styles.moreCount}>{`+${more}`}</span>
                            ) : (
                                category && (
                                    <span className={styles.placeCategory}>
                                        <CategoryIcon
                                            category={category}
                                            size={16}
                                            link={false}
                                        />
                                    </span>
                                )
                            )}
                        </Link>
                    </li>
                )
            })}
            {Array.from({ length: USER_CARD_PLACES - shown.length }, (_, index) => (
                <li
                    key={`empty-${index}`}
                    className={styles.placeEmpty}
                    aria-hidden={true}
                />
            ))}
        </ul>
    )
}
