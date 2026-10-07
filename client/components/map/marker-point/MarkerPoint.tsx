import React, { useMemo, useState } from 'react'
import { Marker, Popup } from 'react-leaflet'
import Leaflet from 'leaflet'
import { Skeleton } from 'simple-react-ui-kit'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel } from '@/api'
import { useAppDispatch } from '@/app/store'
import { AddToCollectionButton, BookmarkButton, PlacePlate } from '@/components/shared'
import { IMG_HOST } from '@/config/env'
import { categoryImage } from '@/utils/categories'
import { addDecimalPoint, buildPlaceUrl, numberFormatter } from '@/utils/helpers'

import styles from './styles.module.sass'

interface MarkerPointProps {
    place: ApiModel.PlaceMark
    keepInView?: boolean
}

const MarkerPointComponent: React.FC<MarkerPointProps> = ({ place, keepInView }) => {
    const { t } = useTranslation('common')
    const dispatch = useAppDispatch()

    // Cached per place: reopening the same popup does not refetch the card
    const [getPlaceItem, { data: poiData }] = API.useLazyPoiGetItemQuery()
    const [bookmarkReady, setBookmarkReady] = useState(false)

    const placeMarkerIcon = useMemo(
        () =>
            new Leaflet.Icon({
                iconAnchor: [10, 10],
                iconSize: [20, 20],
                iconUrl: categoryImage(place.category).src
            }),
        [place.category]
    )

    const placeClickHandler = async () => {
        if (!place.id) {
            return
        }

        const { data } = await getPlaceItem(place.id, true)

        // The POI response already carries the bookmark state for signed-in users: seed the
        // BookmarkButton cache with it before the button gets its placeId, so it does not
        // send its own check request
        if (data?.bookmarked !== undefined) {
            await dispatch(
                API.util.upsertQueryData('bookmarksGetPlace', { placeId: data.id }, { result: data.bookmarked })
            )
        }

        setBookmarkReady(true)
    }

    return (
        <Marker
            position={[place.lat, place.lon]}
            icon={placeMarkerIcon}
            eventHandlers={{
                click: placeClickHandler
            }}
        >
            {place.id && (
                <Popup
                    autoClose={true}
                    closeOnEscapeKey={true}
                    autoPan={keepInView}
                    keepInView={keepInView}
                    className={styles.markerPointPopup}
                >
                    <div className={styles.content}>
                        <Link
                            href={buildPlaceUrl(place.id!, poiData?.slug)}
                            title={poiData?.title}
                        >
                            {!poiData && <Skeleton />}

                            {poiData?.cover && (
                                <Image
                                    className={styles.image}
                                    src={`${IMG_HOST}${poiData.cover.preview}`}
                                    alt={poiData.title || ''}
                                    width={300}
                                    height={220}
                                />
                            )}

                            {poiData && !poiData.cover && (
                                <Image
                                    className={styles.image}
                                    src={'/images/no-image.svg'}
                                    alt={poiData.title || ''}
                                    width={300}
                                    height={220}
                                />
                            )}
                        </Link>

                        <div className={styles.actions}>
                            <BookmarkButton
                                placeId={bookmarkReady ? poiData?.id : undefined}
                                size={'small'}
                                hideLabel={true}
                            />
                            <AddToCollectionButton
                                placeId={poiData?.id}
                                size={'small'}
                                hideLabel={true}
                            />
                        </div>

                        <div
                            className={styles.bottomPanel}
                            style={{
                                opacity: poiData ? 1 : 0
                            }}
                        >
                            <div className={styles.iconsPanel}>
                                {!!poiData?.rating && (
                                    <PlacePlate
                                        icon={'StarEmpty'}
                                        tooltip={t('rating', { defaultValue: 'Рейтинг' })}
                                        content={addDecimalPoint(poiData.rating)}
                                    />
                                )}

                                {!!poiData?.comments && (
                                    <PlacePlate
                                        icon={'Comment'}
                                        tooltip={t('comments-title', { defaultValue: 'Отзывы' })}
                                        content={poiData.comments}
                                    />
                                )}

                                {!!poiData?.bookmarks && (
                                    <PlacePlate
                                        icon={'HeartEmpty'}
                                        tooltip={t('in-bookmarks', { defaultValue: 'В закладках' })}
                                        content={poiData.bookmarks}
                                    />
                                )}

                                {!!poiData?.distance && (
                                    <PlacePlate
                                        icon={'Ruler'}
                                        tooltip={t('sort_distance', { defaultValue: 'Расстояние' })}
                                        content={
                                            numberFormatter(poiData.distance) + ' ' + t('km', { defaultValue: 'км' })
                                        }
                                    />
                                )}
                            </div>

                            <h3 className={styles.title}>{poiData?.title}</h3>
                        </div>
                    </div>
                </Popup>
            )}
        </Marker>
    )
}

/** Memoized: markers don't re-render just because the map's own state changed. */
export const MarkerPoint = React.memo(MarkerPointComponent)
