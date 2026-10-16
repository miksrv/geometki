import React from 'react'
import { Icon } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { MediaTile, mediaTileStyles } from '@/components/shared/media-tile'
import { UserAvatar } from '@/components/shared/user-avatar'
import { IMG_HOST } from '@/config/env'
import { buildCollectionUrl, numberFormatter, timeAgo } from '@/utils/helpers'

/** What the card shows: a whole collection, or the part of it a feed story carries */
type CollectionCardData = Pick<
    ApiModel.Collection,
    'id' | 'slug' | 'title' | 'cover' | 'covers' | 'placesCount' | 'region'
> &
    Partial<Pick<ApiModel.Collection, 'author' | 'views' | 'updated'>>

interface CollectionCardProps {
    collection: CollectionCardData
    /** Preload the cover (above-the-fold tiles only) */
    priority?: boolean
    /** The author over the cover; off where the author is already shown (a feed story) */
    showAuthor?: boolean
    /** Heading level of the title: 2 in standalone lists (default), 3 inside another titled block */
    headingLevel?: 2 | 3
}

/**
 * Collection tile: MediaTile chrome with a cover mosaic of the first places (what tells a
 * collection from a place at a glance), the author on top and collection facts below.
 */
export const CollectionCard: React.FC<CollectionCardProps> = ({
    collection,
    priority,
    showAuthor = true,
    headingLevel = 2
}) => {
    const { t, i18n } = useTranslation()

    const href = buildCollectionUrl(collection.id, collection.slug)
    const Heading = headingLevel === 3 ? 'h3' : 'h2'

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
                showAuthor &&
                collection.author && (
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
                )
            }
        >
            <Heading className={mediaTileStyles.title}>
                <Link
                    href={href}
                    title={collection.title}
                >
                    {collection.title}
                </Link>
            </Heading>

            {/* One line: the region gives way to the places count and views */}
            <div className={mediaTileStyles.meta}>
                {collection.region && (
                    <Link
                        href={`/collections?region=${collection.region.id}`}
                        title={`${t('collections_all-in-region', { defaultValue: 'Все коллекции в регионе' })} ${collection.region.name}`}
                        className={mediaTileStyles.region}
                    >
                        {collection.region.name}
                    </Link>
                )}

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
