import React from 'react'
import { Icon } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { MediaTile, mediaTileStyles } from '@/components/shared/media-tile'
import { UserAvatar } from '@/components/shared/user-avatar'
import { IMG_HOST } from '@/config/env'
import { buildCollectionUrl, numberFormatter, timeAgo } from '@/utils/helpers'

interface CollectionCardProps {
    collection: ApiModel.Collection
    /** Preload the cover (above-the-fold tiles only) */
    priority?: boolean
}

/**
 * Collection tile: MediaTile chrome with a cover mosaic of the first places (what tells a
 * collection from a place at a glance), the author on top and collection facts below.
 */
export const CollectionCard: React.FC<CollectionCardProps> = ({ collection, priority }) => {
    const { t, i18n } = useTranslation()

    const href = buildCollectionUrl(collection.id, collection.slug)

    // Mosaic of the first places' covers; older responses carry only `cover`
    const covers = (collection.covers ?? (collection.cover ? [collection.cover] : [])).map(
        (cover) => `${IMG_HOST}${cover.preview}`
    )

    return (
        <MediaTile
            href={href}
            title={collection.title}
            covers={covers}
            priority={priority}
            top={
                <UserAvatar
                    user={{
                        id: collection.author.id,
                        name: collection.author.name,
                        avatar: collection.author.avatar ?? undefined
                    }}
                    size={'tiny'}
                    showName={true}
                    hideOnlineIcon={true}
                    caption={timeAgo(collection.updated?.date, undefined, i18n.language)}
                    className={mediaTileStyles.author}
                />
            }
        >
            <h2 className={mediaTileStyles.title}>
                <Link
                    href={href}
                    title={collection.title}
                >
                    {collection.title}
                </Link>
            </h2>

            {collection.region && (
                <div className={mediaTileStyles.subline}>
                    <Link
                        href={`/collections?region=${collection.region.id}`}
                        title={`${t('collections_all-in-region', { defaultValue: 'Все коллекции в регионе' })} ${collection.region.name}`}
                    >
                        {collection.region.name}
                    </Link>
                </div>
            )}

            <div className={mediaTileStyles.stats}>
                <span className={mediaTileStyles.stat}>
                    <Icon name={'Point'} />
                    {t('collections_places-count', {
                        count: collection.placesCount,
                        defaultValue: '{{count}} мест'
                    })}
                </span>

                {!!collection.views && (
                    <span className={mediaTileStyles.stat}>
                        <Icon
                            name={'Eye'}
                            tooltip={t('views', { defaultValue: 'Просмотров' })}
                        />
                        {numberFormatter(collection.views)}
                    </span>
                )}
            </div>
        </MediaTile>
    )
}
