import React from 'react'
import { Icon } from 'simple-react-ui-kit'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { CategoryBadge } from '@/components/shared/category-badge'
import { UserAvatar } from '@/components/shared/user-avatar'
import { IMG_HOST } from '@/config/env'
import { buildPlaceUrl, formatCount } from '@/utils/helpers'

import { haversineDistanceKm } from './utils'

import styles from './styles.module.sass'

interface PlaceSearchCardProps {
    place: ApiModel.Place
    userLat?: number | null
    userLon?: number | null
}

export const PlaceSearchCard: React.FC<PlaceSearchCardProps> = ({ place, userLat, userLon }) => {
    const { t } = useTranslation()

    const distanceKm =
        userLat != null && userLon != null && place.lat && place.lon
            ? haversineDistanceKm(userLat, userLon, place.lat, place.lon)
            : null

    return (
        <article className={styles.card}>
            <Link
                href={buildPlaceUrl(place.id, place.slug)}
                title={place.title}
                className={styles.coverLink}
                aria-label={place.title}
            >
                {place.cover?.preview && (
                    <Image
                        className={styles.cover}
                        src={`${IMG_HOST}${place.cover.preview}`}
                        alt={place.title}
                        width={120}
                        height={80}
                    />
                )}
            </Link>

            <div className={styles.content}>
                <div className={styles.titleRow}>
                    <Link
                        href={buildPlaceUrl(place.id, place.slug)}
                        title={place.title}
                        className={styles.title}
                    >
                        {place.title}
                    </Link>
                </div>

                {place.category && (
                    <CategoryBadge
                        category={place.category}
                        className={styles.categoryBadge}
                    />
                )}

                <div className={styles.meta}>
                    {place.author && (
                        <UserAvatar
                            user={place.author}
                            size={'small'}
                            showName={true}
                            hideOnlineIcon={true}
                            className={styles.author}
                        />
                    )}

                    {!!place.views && (
                        <span className={styles.metaItem}>
                            <Icon name={'Eye'} />
                            {formatCount(place.views)}
                        </span>
                    )}

                    {distanceKm != null && (
                        <span className={styles.metaItem}>
                            <Icon name={'Ruler'} />
                            {distanceKm.toFixed(1)}&nbsp;{t('km', { defaultValue: 'км' })}
                        </span>
                    )}
                </div>
            </div>
        </article>
    )
}
