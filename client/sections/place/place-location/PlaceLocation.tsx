import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Container, Icon } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel, ApiType } from '@/api'
import { CopyCoordinates, MapLinks, WasHereButton } from '@/components/shared'
import { buildLocationHref, formatThousands, getLandingFlags } from '@/utils/helpers'

import styles from './styles.module.sass'

const InteractiveMap = dynamic(() => import('@/components/map/InteractiveMap'), { ssr: false })

// Most specific first: "Кувандыкский округ, Оренбургская область, Россия"
const addressTypes: ApiType.LocationTypes[] = ['locality', 'district', 'region', 'country']

interface PlaceLocationProps {
    place?: ApiModel.Place
    /** The closest places: markers on the mini map, each opening its card and page */
    nearPlaces?: ApiModel.PlaceListItem[] | null
    /** Who has been here and the collections with the place (`PlaceVisited`, `PlaceCollections`) */
    children?: React.ReactNode
}

/**
 * "Где это": everything about getting there in one card — the map with the place and its
 * neighbours, the distance and the address (every level a link to its places), the
 * coordinates, the navigators, then who has been here with "Я здесь был(а)" and the
 * collections with the place. Sticky in the right column on desktop, right after the text
 * on phones: read → see where → go. The author and the dates are in "О месте".
 */
export const PlaceLocation: React.FC<PlaceLocationProps> = ({ place, nearPlaces, children }) => {
    const { t } = useTranslation()

    const mapRef = useRef<HTMLDivElement>(null)
    // The Leaflet chunk is loaded once the card is near the viewport: above the fold on
    // desktop, below the text on phones. The box keeps its height either way (styles), so
    // nothing shifts when the map mounts.
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

    const landingFlags = getLandingFlags()

    const addressLevels = addressTypes
        .map((type) => ({ type, item: place.address?.[type] }))
        .filter(({ item }) => !!item?.id && !!item.name)

    const address = (!!addressLevels.length || !!place.address?.street) && (
        <span className={styles.address}>
            {place.address?.street && `${place.address.street}, `}
            {addressLevels.map(({ type, item }, index) => (
                <React.Fragment key={type}>
                    <Link
                        href={buildLocationHref({ id: item!.id!, slug: item!.slug, type }, landingFlags)}
                        title={`${t('all-geotags-at-address')} ${item!.name}`}
                    >
                        {item!.name}
                    </Link>
                    {index < addressLevels.length - 1 && ', '}
                </React.Fragment>
            ))}
        </span>
    )

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

            <div className={styles.body}>
                {(!!place.distance || address) && (
                    <div className={styles.row}>
                        <Icon name={'Point'} />
                        <div className={styles.rowText}>
                            {place.distance ? (
                                <>
                                    <strong>
                                        {t('distance-from-you', {
                                            distance: formatThousands(place.distance),
                                            defaultValue: '{{distance}} км от вас'
                                        })}
                                    </strong>
                                    {address}
                                </>
                            ) : (
                                <strong>{address}</strong>
                            )}
                        </div>
                    </div>
                )}

                <div className={styles.row}>
                    <Icon
                        name={'Position'}
                        tooltip={t('coordinates')}
                    />
                    <span className={styles.coordinates}>
                        <CopyCoordinates
                            lat={place.lat}
                            lon={place.lon}
                        />
                    </span>
                </div>

                <div className={styles.navigators}>
                    <MapLinks
                        title={place.title}
                        lat={place.lat}
                        lon={place.lon}
                        showTitle={true}
                        label={'brand'}
                        logoSize={24}
                        linkClassName={styles.navigator}
                    />
                </div>

                <div className={styles.divider} />

                {children}

                <WasHereButton
                    size={'medium'}
                    stretched={true}
                    placeId={place.id}
                    verificationExempt={place.verificationExempt}
                />
            </div>
        </Container>
    )
}
