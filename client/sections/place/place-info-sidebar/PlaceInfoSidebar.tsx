import React from 'react'
import { Container, Icon } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { CopyCoordinates, MapLinks, UserAvatar, UserAvatarGroup } from '@/components/shared'
import { formatDate, formatThousands } from '@/utils/helpers'

import styles from './styles.module.sass'

const InteractiveMap = dynamic(() => import('@/components/map/InteractiveMap'), { ssr: false })

interface PlaceInfoSidebarProps {
    place?: ApiModel.Place
}

export const PlaceInfoSidebar: React.FC<PlaceInfoSidebarProps> = ({ place }) => {
    const { t } = useTranslation()

    return (
        <Container className={styles.component}>
            <ul>
                <li>
                    <Icon name={'User'} />
                    <div className={styles.info}>
                        <div className={styles.key}>{t('author')}</div>
                        <div className={styles.value}>
                            <UserAvatar
                                user={place?.author}
                                showName={true}
                            />
                        </div>
                    </div>
                </li>
                {!!place?.editors?.length && (
                    <li>
                        <Icon name={'Users'} />
                        <div className={styles.info}>
                            <div className={styles.key}>{t('editors')}</div>
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
                        </div>
                    </li>
                )}
                <li>
                    <Icon name={'Eye'} />
                    <div className={styles.info}>
                        <div className={styles.key}>{t('views')}</div>
                        <div className={styles.value}>{formatThousands(place?.views || 0)}</div>
                    </div>
                </li>
                {place?.created && (
                    <li>
                        <Icon name={'Time'} />
                        <div className={styles.info}>
                            <div className={styles.key}>{t('created')}</div>
                            <div className={styles.value}>{formatDate(place.created.date, t('date-time-format'))}</div>
                        </div>
                    </li>
                )}
                {place?.updated && (
                    <li>
                        <Icon name={'Time'} />
                        <div className={styles.info}>
                            <div className={styles.key}>{t('edited')}</div>
                            <div className={styles.value}>{formatDate(place.updated.date, t('date-time-format'))}</div>
                        </div>
                    </li>
                )}
                {place?.distance && (
                    <li>
                        <Icon name={'Ruler'} />
                        <div className={styles.info}>
                            <div className={styles.key}>{t('distance-to-me')}</div>
                            <div className={styles.value}>{`${formatThousands(place.distance)} ${t('km')}`}</div>
                        </div>
                    </li>
                )}
                <li>
                    <Icon name={'Point'} />
                    <div className={styles.info}>
                        <div className={styles.key}>{t('coordinates')}</div>
                        <div className={styles.value}>
                            <CopyCoordinates
                                lat={place?.lat || 0}
                                lon={place?.lon || 0}
                            />
                        </div>
                    </div>
                </li>
            </ul>

            {place?.id && place.category && (
                <div className={styles.map}>
                    <InteractiveMap
                        zoom={14}
                        center={[place.lat, place.lon]}
                        enableFullScreen={false}
                        scrollWheelZoom={false}
                        dragging={false}
                        controlsSize={'small'}
                        fullMapLink={`/map#${place.lat},${place.lon},14`}
                        places={[{ category: place.category.name, lat: place.lat, lon: place.lon }]}
                    />
                </div>
            )}

            <ul className={styles.mapLinks}>
                <MapLinks
                    title={place?.title}
                    lat={place?.lat ?? 0}
                    lon={place?.lon ?? 0}
                    showTitle={true}
                    asListItem={true}
                />
            </ul>
        </Container>
    )
}
