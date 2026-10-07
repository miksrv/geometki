import React from 'react'
import { cn, Icon } from 'simple-react-ui-kit'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { CategoryIcon } from '@/components/shared/category-icon'
import { MediaTile, mediaTileStyles } from '@/components/shared/media-tile'
import { IMG_HOST } from '@/config/env'
import { addressToString } from '@/utils/address'
import { addDecimalPoint, buildPlaceUrl, dateToUnixTime, numberFormatter } from '@/utils/helpers'

import styles from './styles.module.sass'

export type PlaceCardVariant = 'tile' | 'row'

export interface PlaceCardProps {
    place: ApiModel.PlaceListItem
    /** `tile` — photo card for grids and carousels (default); `row` — thumbnail + text for dense lists */
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
    /** Row only: element before the thumbnail, e.g. a position number */
    leading?: React.ReactNode
    /** Controls: on the right of a row, or in the top-right corner over a tile's cover (owner actions) */
    actions?: React.ReactNode
    /** Row only: block under the meta, e.g. an author's note */
    footer?: React.ReactNode
    className?: string
}

/**
 * The one card for a place. Both variants keep the same recognisable parts in the same
 * order: cover, category icon, title, address, then the stats row (rating, distance,
 * views, photos). The category is shown as its icon only (top-left over a tile's cover,
 * before the title in a row); its name is in the tooltip. Only the geometry changes between `tile` and `row`. A card is about the
 * place, so it never shows who added it or when.
 */
export const PlaceCard: React.FC<PlaceCardProps> = ({
    place,
    variant = 'tile',
    size = 'medium',
    distanceKm,
    distanceLabel,
    headingLevel = 2,
    priority,
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

    const stats = (statClassName: string) => (
        <>
            {!!place.rating && (
                <span className={statClassName}>
                    <Icon
                        name={'StarEmpty'}
                        tooltip={t('rating', { defaultValue: 'Рейтинг' })}
                    />
                    {addDecimalPoint(place.rating)}
                </span>
            )}

            {distanceText && (
                <span className={statClassName}>
                    <Icon
                        name={'Ruler'}
                        tooltip={t('sort_distance', { defaultValue: 'Расстояние' })}
                    />
                    {distanceText}
                </span>
            )}

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
                            alt={''}
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

                    {footer && <div className={styles.footer}>{footer}</div>}
                </div>

                {actions && <div className={styles.actions}>{actions}</div>}
            </article>
        )
    }

    return (
        <MediaTile
            href={href}
            title={place.title ?? ''}
            priority={priority}
            className={className}
            top={
                place.category || actions ? (
                    <div className={styles.tileTop}>
                        {place.category && (
                            <CategoryIcon
                                category={place.category}
                                size={16}
                                className={styles.tileCategory}
                            />
                        )}
                        {actions && <div className={styles.tileActions}>{actions}</div>}
                    </div>
                ) : undefined
            }
            // `updated` only versions the cover URL: the preview path stays the same when the cover changes
            coverSrc={
                place.cover?.preview
                    ? `${IMG_HOST}${place.cover.preview}?d=${dateToUnixTime(place.updated?.date)}`
                    : undefined
            }
        >
            <Heading className={mediaTileStyles.title}>
                <Link
                    href={href}
                    title={place.title}
                >
                    {place.title}
                </Link>
            </Heading>

            {!!address?.length && (
                <div className={mediaTileStyles.subline}>
                    {address.map((item, i, array) => (
                        <span key={`address${item.type}${place.id}`}>
                            <Link
                                href={`/places?${item.type}=${item.id}`}
                                title={`${t('all-geotags-at-address')} ${item.name}`}
                            >
                                {item.name}
                            </Link>
                            {array.length - 1 !== i && ', '}
                        </span>
                    ))}
                </div>
            )}

            <div className={mediaTileStyles.stats}>{stats(mediaTileStyles.stat)}</div>
        </MediaTile>
    )
}
