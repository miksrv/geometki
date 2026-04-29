import React from 'react'
import { TFunction } from 'i18next'

import Image from 'next/image'
import Link from 'next/link'

import { ApiModel } from '@/api'
import { PlacePlate } from '@/components/shared'
import { IMG_HOST } from '@/config/env'
import { addressToString } from '@/utils/address'
import { categoryImage } from '@/utils/categories'
import { addDecimalPoint, dateToUnixTime, numberFormatter, removeMarkdown } from '@/utils/helpers'

import styles from './styles.module.sass'

interface PlacesListItemProps {
    t: TFunction
    place: ApiModel.Place
}

export const PlacesListItem: React.FC<PlacesListItemProps> = ({ t, place }) => (
    <article className={styles.placesListItem}>
        <div className={styles.photoSection}>
            <Image
                className={styles.categoryIcon}
                src={categoryImage(place.category?.name).src}
                alt={place.category?.title || ''}
                width={22}
                height={26}
            />

            <Link
                href={`/places/${place.id}`}
                title={place.title}
            >
                {place.cover && (
                    <Image
                        className={styles.photo}
                        alt={place.title || ''}
                        quality={70}
                        height={200}
                        width={280}
                        src={`${IMG_HOST}${place.cover.preview}?d=${dateToUnixTime(place.updated?.date)}`}
                    />
                )}
            </Link>

            <div className={styles.bottomPanel}>
                <div className={styles.iconsPanel}>
                    {!!place.rating && (
                        <PlacePlate
                            icon={'StarEmpty'}
                            content={addDecimalPoint(place.rating)}
                        />
                    )}

                    {!!place.distance && (
                        <PlacePlate
                            icon={'Ruler'}
                            content={numberFormatter(place.distance) + ' ' + t('km')}
                        />
                    )}
                </div>

                <h2 className={styles.title}>
                    <Link
                        href={`/places/${place.id}`}
                        title={place.title}
                    >
                        {place.title}
                    </Link>
                </h2>

                <div className={styles.address}>
                    {addressToString(place.address)?.map((address, i, array) => (
                        <span key={`address${address.type}${place.id}`}>
                            <Link
                                href={`/places?${address.type}=${address.id}`}
                                title={`${t('all-geotags-at-address')} ${address.name}`}
                            >
                                {address.name}
                            </Link>
                            {array.length - 1 !== i && ', '}
                        </span>
                    ))}
                </div>
            </div>
        </div>

        <p className={styles.content}>
            {place.content?.length ? (
                removeMarkdown(place.content)
            ) : (
                <span className={styles.emptyContent}>{t('description-not-added-yet')}</span>
            )}
        </p>
    </article>
)
