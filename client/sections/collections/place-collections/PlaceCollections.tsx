import React from 'react'
import { Icon } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { buildCollectionUrl } from '@/utils/helpers'

import styles from '../styles.module.sass'

/** Collections named in the line; the place page prefetches the same request on the server */
export const IN_COLLECTIONS_LIMIT = 3

interface PlaceCollectionsProps {
    placeId?: string
}

/**
 * "В 2 коллекциях: Южный Урал, Заповедники" — one line at the end of the "Где это" card of
 * the place page: the published collections containing the place, each a link, "и ещё N"
 * for the rest. Nothing at all while the place is in none.
 */
export const PlaceCollections: React.FC<PlaceCollectionsProps> = ({ placeId }) => {
    const { t } = useTranslation()

    const { data } = API.useCollectionsGetListQuery({ placeId, limit: IN_COLLECTIONS_LIMIT }, { skip: !placeId })

    if (!data?.items?.length) {
        return null
    }

    const count = data.count ?? data.items.length
    const rest = count - data.items.length

    return (
        <p className={styles.inCollections}>
            <Icon name={'Layers'} />
            <span>
                {t('collections_place-in-n-collections', {
                    count,
                    defaultValue: 'В {{count}} коллекциях'
                })}
                {': '}
                {data.items.map((collection, index) => (
                    <React.Fragment key={collection.id}>
                        {index > 0 && ', '}
                        <Link href={buildCollectionUrl(collection.id, collection.slug)}>{collection.title}</Link>
                    </React.Fragment>
                ))}
                {rest > 0 && ` ${t('and-n-more', { count: rest, defaultValue: 'и ещё {{count}}' })}`}
            </span>
        </p>
    )
}
