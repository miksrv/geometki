import React from 'react'
import { Container } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'

import { CollectionCard } from '../collection-card'

import styles from '../styles.module.sass'

const IN_COLLECTIONS_LIMIT = 6

interface PlaceCollectionsProps {
    placeId?: string
}

/**
 * "Это место в коллекциях" block on the place page: up to 6 published collections
 * containing this place. Skipped entirely while empty — no empty-state noise on every place.
 */
export const PlaceCollections: React.FC<PlaceCollectionsProps> = ({ placeId }) => {
    const { t } = useTranslation()

    const { data } = API.useCollectionsGetListQuery({ placeId, limit: IN_COLLECTIONS_LIMIT }, { skip: !placeId })

    if (!data?.items?.length) {
        return null
    }

    return (
        <Container title={t('collections_place-in-collections', { defaultValue: 'Это место в коллекциях' })}>
            <div className={styles.grid}>
                {data.items.map((collection) => (
                    <CollectionCard
                        key={collection.id}
                        collection={collection}
                    />
                ))}
            </div>
        </Container>
    )
}
