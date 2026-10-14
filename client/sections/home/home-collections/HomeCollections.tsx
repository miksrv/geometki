import React from 'react'
import { Button, cn, Icon } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { CollectionCard, Section } from '@/components/shared'
import { MediaTileGrid, mediaTileStyles } from '@/components/shared/media-tile'

import styles from './styles.module.sass'

/** One row of the tile grid */
export const HOME_COLLECTIONS_COUNT = 3

interface HomeCollectionsProps {
    collections?: ApiModel.Collection[]
}

/**
 * Ready ideas for a trip. While there are fewer collections than a row, the free slot asks
 * the visitor to make one.
 */
export const HomeCollections: React.FC<HomeCollectionsProps> = ({ collections }) => {
    const { t } = useTranslation()

    if (!collections?.length) {
        return null
    }

    return (
        <Section
            title={t('home-collections-title')}
            action={
                <Button
                    mode={'link'}
                    link={'/collections'}
                    label={t('home-collections-all')}
                />
            }
        >
            <MediaTileGrid>
                {collections.slice(0, HOME_COLLECTIONS_COUNT).map((collection) => (
                    <CollectionCard
                        key={collection.id}
                        collection={collection}
                        headingLevel={3}
                    />
                ))}

                {collections.length < HOME_COLLECTIONS_COUNT && (
                    <Link
                        href={'/collections'}
                        className={cn(mediaTileStyles.tile, styles.create)}
                    >
                        <span className={styles.icon}>
                            <Icon name={'PlusCircle'} />
                        </span>
                        <b>{t('home-collections-create-title')}</b>
                        <span className={styles.text}>{t('home-collections-create-text')}</span>
                    </Link>
                )}
            </MediaTileGrid>
        </Section>
    )
}
