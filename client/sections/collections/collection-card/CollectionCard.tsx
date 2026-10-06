import React from 'react'
import { Icon } from 'simple-react-ui-kit'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { IMG_HOST } from '@/config/env'
import { buildCollectionUrl } from '@/utils/helpers'

import styles from '../styles.module.sass'

interface CollectionCardProps {
    collection: ApiModel.Collection
}

export const CollectionCard: React.FC<CollectionCardProps> = ({ collection }) => {
    const { t } = useTranslation()

    const href = buildCollectionUrl(collection.id, collection.slug)

    return (
        <Link
            href={href}
            className={styles.card}
            title={collection.title}
        >
            <div className={styles.cardCover}>
                {collection.cover && (
                    <Image
                        src={`${IMG_HOST}${collection.cover.preview}`}
                        alt={collection.title}
                        fill
                        sizes={'(max-width: 768px) 100vw, 33vw'}
                        style={{ objectFit: 'cover' }}
                    />
                )}
            </div>

            <div className={styles.cardBody}>
                <h2 className={styles.cardTitle}>{collection.title}</h2>

                <div className={styles.cardMeta}>
                    <span>
                        <Icon name={'Point'} />{' '}
                        {t('collections_places-count', {
                            count: collection.placesCount,
                            defaultValue: '{{count}} мест'
                        })}
                    </span>
                    {collection.region && <span>{collection.region.name}</span>}
                    {collection.category && <span>{collection.category.title}</span>}
                </div>
            </div>
        </Link>
    )
}
