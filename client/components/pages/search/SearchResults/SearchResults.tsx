import React, { useState } from 'react'
import { Button } from 'simple-react-ui-kit'

import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel, ApiType } from '@/api'
import { CoordinatesItem } from '@/components/pages/search/CoordinatesItem'
import { LocationItem } from '@/components/pages/search/LocationItem'
import { PlaceCard } from '@/components/shared/place-card'
import { haversineDistanceKm } from '@/utils/geo'

import styles from './styles.module.sass'

const MAX_LOCATIONS_SHOWN = 3

interface SearchResultsProps {
    data: ApiType.Search.Response
    type?: ApiType.Search.Request['type']
    userLat?: number | null
    userLon?: number | null
    onLoadMore: () => void
    isLoadingMore: boolean
}

export const SearchResults: React.FC<SearchResultsProps> = ({
    data,
    type,
    userLat,
    userLon,
    onLoadMore,
    isLoadingMore
}) => {
    const { t } = useTranslation()
    const router = useRouter()

    const [showAllLocations, setShowAllLocations] = useState(false)

    const locations = data.locations?.items ?? []
    const locationsCount = data.locations?.count ?? 0
    const places = data.places?.items ?? []
    const coordinates = data.coordinates

    const visibleLocations = showAllLocations ? locations : locations.slice(0, MAX_LOCATIONS_SHOWN)
    const hiddenLocationsCount = locationsCount - MAX_LOCATIONS_SHOWN

    const showLocations = (!type || type === 'all' || type === 'location') && locations.length > 0
    const showCoordinates = (!type || type === 'all' || type === 'coordinates') && coordinates != null
    const showPlaces = (!type || type === 'all' || type === 'places') && places.length > 0

    const handleLocationClick = async (location: ApiModel.GeoSearchLocation) => {
        if (location.lat != null && location.lon != null) {
            const hash = `${location.lat},${location.lon},12?m=${location.lat},${location.lon}`

            if (router.pathname === '/map') {
                await router.replace({ hash, pathname: '/map' })
            } else {
                await router.push(`/map#${hash}`)
            }
        }
    }

    const handleCoordinatesClick = async (lat: number, lon: number) => {
        const hash = `${lat},${lon},14?m=${lat},${lon}`

        if (router.pathname === '/map') {
            await router.replace({ hash, pathname: '/map' })
        } else {
            await router.push(`/map#${hash}`)
        }
    }

    return (
        <div className={styles.results}>
            {showLocations && (
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>{t('search-results-locations', { defaultValue: 'Адреса' })}</h2>

                    <div className={styles.locationList}>
                        {visibleLocations.map((loc, i) => (
                            <LocationItem
                                key={i}
                                location={loc}
                                onClick={() => void handleLocationClick(loc)}
                            />
                        ))}
                    </div>

                    {!showAllLocations && hiddenLocationsCount > 0 && (
                        <Button
                            mode={'link'}
                            size={'small'}
                            label={t('search-show-more', {
                                count: hiddenLocationsCount,
                                defaultValue: `Показать ещё ${hiddenLocationsCount}`
                            })}
                            onClick={() => setShowAllLocations(true)}
                        />
                    )}
                </section>
            )}

            {showCoordinates && (
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        {t('search-results-coordinates', { defaultValue: 'Координаты' })}
                    </h2>

                    <CoordinatesItem
                        lat={coordinates.lat}
                        lon={coordinates.lon}
                        secondary={coordinates.secondary}
                        onClick={() => void handleCoordinatesClick(coordinates.lat, coordinates.lon)}
                    />
                </section>
            )}

            {showPlaces && (
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        {t('search-results-places', { defaultValue: 'Интересные места' })}
                    </h2>

                    <div className={styles.placeList}>
                        {places.map((place) => (
                            <PlaceCard
                                key={place.id}
                                variant={'row'}
                                headingLevel={3}
                                place={place}
                                distanceKm={
                                    userLat != null && userLon != null && place.lat && place.lon
                                        ? haversineDistanceKm({ lat: userLat, lon: userLon }, place)
                                        : undefined
                                }
                            />
                        ))}
                    </div>

                    {(data.places?.count ?? 0) > places.length && (
                        <Button
                            mode={'secondary'}
                            size={'medium'}
                            stretched={true}
                            loading={isLoadingMore}
                            disabled={isLoadingMore}
                            label={t('search-load-more', { defaultValue: 'Загрузить ещё' })}
                            onClick={onLoadMore}
                        />
                    )}
                </section>
            )}
        </div>
    )
}
