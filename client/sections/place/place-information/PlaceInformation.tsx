import React from 'react'
import { Button, Container, Icon } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { MapLinks, UserAvatar, UserAvatarGroup } from '@/components/shared'
import { categoryImage } from '@/utils/categories'
import { convertDMS } from '@/utils/coordinates'
import { formatDate } from '@/utils/helpers'

import styles from './styles.module.sass'

const InteractiveMap = dynamic(() => import('@/components/map/InteractiveMap'), {
    ssr: false
})

interface PlaceInformationProps {
    place?: ApiModel.Place
}

export const PlaceInformation: React.FC<PlaceInformationProps> = ({ place }) => {
    const { t } = useTranslation()

    return (
        <Container className={styles.component}>
            <ul className={styles.information}>
                <li>
                    <Icon name={'Bookmark'} />
                    <div className={styles.key}>{t('category')}</div>
                    <div className={styles.value}>
                        <Image
                            src={categoryImage(place?.category?.name).src}
                            alt={place?.category?.title || ''}
                            width={18}
                            height={18}
                            style={{ marginRight: '4px' }}
                        />
                        <Link
                            href={`/places?category=${place?.category?.name}`}
                            title={`${place?.category?.title} - ${t('all-geotags-at-address')}`}
                        >
                            {place?.category?.title}
                        </Link>
                    </div>
                </li>
                <li>
                    <Icon name={'User'} />
                    <div className={styles.key}>{t('author')}:</div>
                    <div className={styles.value}>
                        <UserAvatar
                            user={place?.author}
                            showName={true}
                        />
                    </div>
                </li>
                {!!place?.editors?.length && (
                    <li>
                        <Icon name={'Users'} />
                        <div className={styles.key}>{t('editors')}:</div>
                        <div className={styles.value}>
                            {place.editors.length === 1 ? (
                                <UserAvatar
                                    user={place.editors[0]}
                                    showName={true}
                                />
                            ) : (
                                <UserAvatarGroup
                                    size={'small'}
                                    users={place.editors}
                                />
                            )}
                        </div>
                    </li>
                )}
                <li>
                    <Icon name={'Eye'} />
                    <div className={styles.key}>{t('views')}:</div>
                    <div className={styles.value}>{place?.views || 0}</div>
                </li>
                {place?.updated && (
                    <li>
                        <Icon name={'Time'} />
                        <div className={styles.key}>{t('edited')}</div>
                        <div className={styles.value}>{formatDate(place.updated.date, t('date-time-format'))}</div>
                    </li>
                )}
                {place?.distance && (
                    <li>
                        <Icon name={'Ruler'} />
                        <div className={styles.key}>{t('distance-to-me')}:</div>
                        <div className={styles.value}>{`${place.distance} ${t('km')}`}</div>
                    </li>
                )}
                <li>
                    <Icon name={'Point'} />
                    <div className={styles.key}>{t('coordinates')}:</div>
                    <div className={styles.value}>
                        <span className={styles.coordinatesLink}>{convertDMS(place?.lat || 0, place?.lon || 0)}</span>
                        <MapLinks
                            title={place?.title}
                            lat={place?.lat ?? 0}
                            lon={place?.lon ?? 0}
                        />
                    </div>
                </li>
            </ul>
            <div className={styles.map}>
                {place?.id && place.category && (
                    <InteractiveMap
                        zoom={15}
                        center={[place.lat, place.lon]}
                        enableFullScreen={false}
                        scrollWheelZoom={false}
                        dragging={false}
                        controlsSize={'small'}
                        fullMapLink={`/map#${place.lat},${place.lon},14`}
                        places={[
                            {
                                category: place.category.name,
                                lat: place.lat,
                                lon: place.lon
                            }
                        ]}
                    />
                )}

                <Button
                    className={styles.openMapButton}
                    style={{ width: '100%' }}
                    mode={'primary'}
                    link={`/map#${place?.lat},${place?.lon},14`}
                    disabled={!place?.lat || !place?.lon}
                >
                    {t('open-on-map')}
                </Button>
            </div>
        </Container>
    )
}
