import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Container, Icon } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { CopyCoordinates, UserAvatar, UserAvatarGroup } from '@/components/shared'
import { formatDate } from '@/utils/helpers'

import styles from './styles.module.sass'

const InteractiveMap = dynamic(() => import('@/components/map/InteractiveMap'), { ssr: false })

interface PlaceSidebarProps {
    place?: ApiModel.Place
    /** The closest places: markers on the mini map, each opening its card and page */
    nearPlaces?: ApiModel.PlaceListItem[] | null
    /** The sidebar blocks under the facts (visited, collections); an empty block takes no room */
    children?: React.ReactNode
}

/**
 * The one card of the place page sidebar: the mini map with the place and its neighbours,
 * then the facts as "icon → value" rows without labels (coordinates, the last update,
 * the author, the editors), then the sidebar blocks separated by rules. Nothing from the
 * hero (address, views, distance) or the toolbar (map link, route) is repeated here. The
 * creation date is not shown: it stays in the structured data of the page.
 */
export const PlaceSidebar: React.FC<PlaceSidebarProps> = ({ place, nearPlaces, children }) => {
    const { t } = useTranslation()

    const mapRef = useRef<HTMLDivElement>(null)
    // The Leaflet chunk is loaded once the card is near the viewport: above the fold on
    // desktop, far below the photos and the description on phones. The box keeps its height
    // either way (styles), so nothing shifts when the map mounts.
    const [mapNear, setMapNear] = useState<boolean>(false)

    useEffect(() => {
        const element = mapRef.current

        if (!element || typeof IntersectionObserver === 'undefined') {
            setMapNear(true)
            return
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setMapNear(true)
                    observer.disconnect()
                }
            },
            { rootMargin: '400px 0px' }
        )

        observer.observe(element)

        return () => observer.disconnect()
    }, [])

    const marks = useMemo<ApiModel.PlaceMark[]>(() => {
        if (!place?.category) {
            return []
        }

        return [
            // The place itself has no id: no popup for the page you are already on
            { category: place.category, lat: place.lat, lon: place.lon },
            ...(nearPlaces ?? [])
                .filter((item): item is ApiModel.PlaceListItem & { category: ApiModel.Categories } => !!item.category)
                .map((item) => ({ id: item.id, category: item.category, lat: item.lat, lon: item.lon }))
        ]
    }, [place?.category, place?.lat, place?.lon, nearPlaces])

    if (!place) {
        return null
    }

    const updated = place.updated?.date ?? place.created?.date

    return (
        <Container
            className={styles.card}
            aria-label={t('place-location-card', { defaultValue: 'Где это' })}
        >
            <div
                ref={mapRef}
                className={styles.map}
            >
                {mapNear && place.category && (
                    <InteractiveMap
                        zoom={14}
                        center={[place.lat, place.lon]}
                        enableFullScreen={false}
                        scrollWheelZoom={false}
                        dragging={false}
                        controlsSize={'small'}
                        fullMapLink={`/map#${place.lat},${place.lon},14`}
                        places={marks}
                    />
                )}
            </div>

            <ul className={styles.facts}>
                <li>
                    <Icon
                        name={'Point'}
                        tooltip={t('coordinates')}
                    />
                    <span>
                        <CopyCoordinates
                            lat={place.lat}
                            lon={place.lon}
                        />
                    </span>
                </li>
                {updated && (
                    <li>
                        <Icon
                            name={'Calendar'}
                            tooltip={t('edited')}
                        />
                        <span>{formatDate(updated, t('date-format'))}</span>
                    </li>
                )}
                {place.author && (
                    <li>
                        <Icon
                            name={'User'}
                            tooltip={t('author')}
                        />
                        <span>
                            <UserAvatar
                                user={place.author}
                                size={'small'}
                                showName={true}
                            />
                        </span>
                    </li>
                )}
                {!!place.editors?.length && (
                    <li>
                        <Icon
                            name={'Users'}
                            tooltip={t('editors')}
                        />
                        <span>
                            {place.editors.length === 1 ? (
                                <UserAvatar
                                    user={place.editors[0]}
                                    size={'small'}
                                    showName={true}
                                />
                            ) : (
                                <UserAvatarGroup
                                    size={'small'}
                                    users={place.editors}
                                />
                            )}
                        </span>
                    </li>
                )}
            </ul>

            {React.Children.map(children, (child) => (child ? <div className={styles.block}>{child}</div> : null))}
        </Container>
    )
}
