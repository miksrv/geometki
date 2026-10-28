import React from 'react'
import { cn, Icon } from 'simple-react-ui-kit'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { CategoryIcon } from '@/components/shared/category-icon'
import { IMG_HOST } from '@/config/env'
import { addressToString } from '@/utils/address'
import {
    addDecimalPoint,
    buildLocationHref,
    buildPlaceUrl,
    dateToUnixTime,
    getLandingFlags,
    numberFormatter,
    removeMarkdown
} from '@/utils/helpers'

import { PlaceCardBookmark } from './PlaceCardBookmark'

import styles from './styles.module.sass'

export type PlaceCardVariant = 'tile' | 'row'

export interface PlaceCardProps {
    place: ApiModel.PlaceListItem
    /** `tile` — photo card for grids and card rails (default); `row` — thumbnail + text for dense lists */
    variant?: PlaceCardVariant
    /** Row density: `small` uses a 96×72 thumbnail (pickers, map popup), `medium` 120×80 (search) */
    size?: 'medium' | 'small'
    /** Distance to show in the stats; falls back to `place.distance` from the API */
    distanceKm?: number
    /** Custom text for the distance stat, e.g. "2.4 km from the previous one" */
    distanceLabel?: string
    /** Heading level of the title: 2 in standalone lists (default), 3 inside another titled block */
    headingLevel?: 2 | 3
    /** Preload the cover (above-the-fold tiles only) */
    priority?: boolean
    /** Tile only: the cover's `sizes` when the tile is not in the three-column grid (card rails) */
    sizes?: string
    /** Row only: element before the thumbnail, e.g. a position number */
    leading?: React.ReactNode
    /** Controls: on the right of a row, or in the top-right corner over a tile's cover instead of the bookmark (owner actions) */
    actions?: React.ReactNode
    /** Row only: block under the meta, e.g. an author's note */
    footer?: React.ReactNode
    className?: string
}

/**
 * The one card for a place. Both variants keep the same recognisable parts in the same
 * order: cover, category icon, title, address, then the stats row (rating, distance,
 * views, photos). The category is shown as its icon only (top-left over a tile's cover,
 * before the title in a row); its name is in the tooltip. Only the geometry changes between
 * `tile` and `row`: a tile is a 2:1 cover with the text under it on the page background, the
 * bookmark toggle over the top-right corner (or the owner `actions` in its place) and a
 * "you were here" badge for the visitor's visited places. A card is about the place, so it
 * never shows who added it or when.
 */
export const PlaceCard: React.FC<PlaceCardProps> = ({
    place,
    variant = 'tile',
    size = 'medium',
    distanceKm,
    distanceLabel,
    headingLevel = 2,
    priority,
    sizes,
    leading,
    actions,
    footer,
    className
}) => {
    const { t } = useTranslation()

    const href = buildPlaceUrl(place.id, place.slug)
    const address = addressToString(place.address)
    const distance = distanceKm ?? (place.distance || undefined)
    const Heading = headingLevel === 3 ? 'h3' : 'h2'

    const distanceText =
        distance !== undefined ? (distanceLabel ?? `${numberFormatter(distance)} ${t('km')}`) : undefined

    // A tile puts the rating as a gold star with a bold number and the distance as plain
    // accent text, the first things to compare in a grid; a row keeps quiet icons for all
    const stats = (statClassName: string, tile?: boolean) => (
        <>
            {!!place.rating && (
                <span className={statClassName}>
                    <Icon
                        name={tile ? 'StarFilled' : 'StarEmpty'}
                        className={tile ? styles.tileStar : undefined}
                        tooltip={t('rating', { defaultValue: 'Рейтинг' })}
                    />
                    {tile ? <b>{addDecimalPoint(place.rating)}</b> : addDecimalPoint(place.rating)}
                </span>
            )}

            {distanceText &&
                (tile ? (
                    <span
                        className={cn(statClassName, styles.tileDistance)}
                        title={t('sort_distance', { defaultValue: 'Расстояние' })}
                    >
                        {distanceText}
                    </span>
                ) : (
                    <span className={statClassName}>
                        <Icon
                            name={'Ruler'}
                            tooltip={t('sort_distance', { defaultValue: 'Расстояние' })}
                        />
                        {distanceText}
                    </span>
                ))}

            {!!place.views && (
                <span className={statClassName}>
                    <Icon
                        name={'Eye'}
                        tooltip={t('views', { defaultValue: 'Просмотров' })}
                    />
                    {numberFormatter(place.views)}
                </span>
            )}

            {!!place.photos && (
                <span className={statClassName}>
                    <Icon
                        name={'Camera'}
                        tooltip={t('photos-uploaded', { defaultValue: 'Фотографий' })}
                    />
                    {place.photos}
                </span>
            )}
        </>
    )

    if (variant === 'row') {
        return (
            <article className={cn(styles.row, size === 'small' && styles.small, className)}>
                {leading && <div className={styles.leading}>{leading}</div>}

                <Link
                    href={href}
                    className={styles.thumbLink}
                    tabIndex={-1}
                    aria-hidden={true}
                >
                    {place.cover?.preview && (
                        <Image
                            src={`${IMG_HOST}${place.cover.preview}`}
                            alt={place.title ?? ''}
                            fill
                            sizes={size === 'small' ? '96px' : '120px'}
                            style={{ objectFit: 'cover' }}
                        />
                    )}
                </Link>

                <div className={styles.body}>
                    <div className={styles.rowHeading}>
                        {place.category && (
                            <CategoryIcon
                                category={place.category}
                                size={16}
                                className={styles.rowCategory}
                            />
                        )}

                        <Heading className={styles.rowTitle}>
                            <Link
                                href={href}
                                title={place.title}
                            >
                                {place.title}
                            </Link>
                        </Heading>
                    </div>

                    <div className={styles.rowMeta}>
                        {!!address?.length && (
                            <span className={styles.rowAddress}>{address.map((item) => item.name).join(', ')}</span>
                        )}
                        {stats(styles.rowStat)}
                    </div>

                    {place.content && <p className={styles.rowExcerpt}>{removeMarkdown(place.content)}</p>}

                    {footer && <div className={styles.footer}>{footer}</div>}
                </div>

                {actions && <div className={styles.actions}>{actions}</div>}
            </article>
        )
    }

    return (
        <article className={cn(styles.tile, className)}>
            <div className={styles.tileCover}>
                {/* The cover repeats the title link: one tab stop and one name per card */}
                <Link
                    href={href}
                    className={styles.tileCoverLink}
                    tabIndex={-1}
                    aria-hidden={true}
                >
                    {place.cover?.preview && (
                        <Image
                            className={styles.tileImage}
                            alt={place.title ?? ''}
                            quality={75}
                            fill
                            priority={priority}
                            fetchPriority={priority ? 'high' : undefined}
                            sizes={sizes ?? '(max-width: 768px) 100vw, 33vw'}
                            // `updated` only versions the cover URL: the preview path stays the same when the cover changes
                            src={`${IMG_HOST}${place.cover.preview}?d=${dateToUnixTime(place.updated?.date)}`}
                        />
                    )}
                </Link>

                {place.category && (
                    <span className={styles.tileCategory}>
                        <CategoryIcon
                            category={place.category}
                            size={24}
                        />
                    </span>
                )}

                <div className={styles.tileActions}>
                    {actions ?? (
                        <PlaceCardBookmark
                            placeId={place.id}
                            known={place.bookmarked}
                        />
                    )}
                </div>

                {place.visited && (
                    <span className={styles.tileVisited}>
                        <Icon name={'CheckCircle'} />
                        {t('place-card-visited', { defaultValue: 'Вы были здесь' })}
                    </span>
                )}
            </div>

            <Heading className={styles.tileTitle}>
                <Link
                    href={href}
                    title={place.title}
                >
                    {place.title}
                </Link>
            </Heading>

            {!!address?.length && (
                <div className={styles.tileAddress}>
                    {address.map((item, i, array) => (
                        <span key={`address${item.type}${place.id}`}>
                            <Link
                                href={
                                    item.type
                                        ? buildLocationHref(
                                              { id: item.id, slug: item.slug, type: item.type },
                                              getLandingFlags()
                                          )
                                        : '/places'
                                }
                                title={`${t('all-geotags-at-address')} ${item.name}`}
                            >
                                {item.name}
                            </Link>
                            {array.length - 1 !== i && ', '}
                        </span>
                    ))}
                </div>
            )}

            <div className={styles.tileStats}>{stats(styles.tileStat, true)}</div>
        </article>
    )
}
