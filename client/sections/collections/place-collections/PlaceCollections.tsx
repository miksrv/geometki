import React from 'react'
import { cn, Container, Icon } from 'simple-react-ui-kit'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { IMG_HOST } from '@/config/env'
import { buildCollectionUrl } from '@/utils/helpers'

import styles from '../styles.module.sass'

const IN_COLLECTIONS_LIMIT = 5

interface PlaceCollectionsProps {
    placeId?: string
}

/**
 * "В коллекциях" block in the place page sidebar: compact rows (cover, title, places
 * count) for the published collections containing this place, like the "visited here"
 * block next to it. Skipped entirely while empty — no empty-state noise on every place.
 */
export const PlaceCollections: React.FC<PlaceCollectionsProps> = ({ placeId }) => {
    const { t } = useTranslation()

    const { data } = API.useCollectionsGetListQuery({ placeId, limit: IN_COLLECTIONS_LIMIT }, { skip: !placeId })

    if (!data?.items?.length) {
        return null
    }

    const count = data.count ?? data.items.length

    return (
        <Container
            title={`${t('collections_place-in-collections-short', { defaultValue: 'В коллекциях' })} (${count})`}
        >
            <ul className={styles.sidebarRows}>
                {data.items.map((collection) => (
                    <li key={collection.id}>
                        <Link
                            href={buildCollectionUrl(collection.id, collection.slug)}
                            className={cn(styles.pickerRow, styles.sidebarRow)}
                            title={collection.title}
                        >
                            <span className={styles.pickerCover}>
                                {collection.cover?.preview ? (
                                    <Image
                                        src={`${IMG_HOST}${collection.cover.preview}`}
                                        alt={''}
                                        fill
                                        sizes={'40px'}
                                        style={{ objectFit: 'cover' }}
                                    />
                                ) : (
                                    <Icon name={'Layers'} />
                                )}
                            </span>
                            <span className={styles.pickerBody}>
                                <strong>{collection.title}</strong>
                                <span>
                                    {t('collections_places-count', {
                                        count: collection.placesCount,
                                        defaultValue: '{{count}} мест'
                                    })}
                                    {collection.author?.name ? ` · ${collection.author.name}` : ''}
                                </span>
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </Container>
    )
}
