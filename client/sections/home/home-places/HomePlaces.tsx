import React, { useState } from 'react'
import { Button } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel, ApiType } from '@/api'
import { PlaceCard, PlaceCardLoader, Section } from '@/components/shared'
import { Carousel, Tabs } from '@/components/ui'
import useUserLocation from '@/hooks/useUserLocation'

import styles from './styles.module.sass'

type PlacesTab = 'popular' | 'new' | 'nearby'

/** As many as the server sends for the other two tabs */
const NEARBY_LIMIT = 8

interface HomePlacesProps {
    popular?: ApiModel.Place[]
    latest?: ApiModel.Place[]
}

/**
 * "Куда поехать": places as a carousel of tiles, with tabs that say how they were picked —
 * the most viewed this week, the newest, the closest. The closest ask for the location only
 * when the visitor presses the button.
 */
export const HomePlaces: React.FC<HomePlacesProps> = ({ popular, latest }) => {
    const { t } = useTranslation()
    const [tab, setTab] = useState<PlacesTab>('popular')
    const { location, loading: locating, request: requestLocation } = useUserLocation()

    const { data: nearbyData, isFetching: nearbyLoading } = API.usePlacesGetListQuery(
        {
            lat: location?.lat,
            limit: NEARBY_LIMIT,
            lon: location?.lon,
            order: ApiType.SortOrders.ASC,
            sort: ApiType.SortFields.Distance
        },
        { skip: tab !== 'nearby' || !location }
    )

    const places = tab === 'popular' ? popular : tab === 'new' ? latest : nearbyData?.items

    const allLink =
        tab === 'nearby' && location
            ? `/places?lat=${location.lat}&lon=${location.lon}&sort=distance&order=ASC`
            : tab === 'new'
              ? '/places?sort=created_at'
              : '/places?sort=views_week'

    return (
        <Section
            title={t('home-places-title')}
            action={
                <Button
                    mode={'link'}
                    noIndex={tab === 'nearby'}
                    link={allLink}
                    label={t('home-places-all')}
                />
            }
        >
            <Tabs<PlacesTab>
                className={styles.tabs}
                aria-label={t('home-places-title')}
                activeTab={tab}
                tabs={[
                    { key: 'popular', label: t('home-places-tab-popular') },
                    { key: 'new', label: t('home-places-tab-new') },
                    { key: 'nearby', label: t('home-places-tab-nearby') }
                ]}
                onChangeTab={(key) => key && setTab(key)}
            />

            {tab === 'nearby' && !location ? (
                <div className={styles.locate}>
                    <p>{t('home-places-nearby-hint')}</p>
                    <Button
                        mode={'primary'}
                        size={'medium'}
                        icon={'Position'}
                        loading={locating}
                        label={t('home-places-nearby-button')}
                        onClick={() => void requestLocation()}
                    />
                </div>
            ) : nearbyLoading && tab === 'nearby' ? (
                <div className={styles.loaders}>
                    {[0, 1, 2].map((i) => (
                        <PlaceCardLoader key={i} />
                    ))}
                </div>
            ) : places?.length ? (
                // Remounted per tab: Embla keeps the scroll position of the old slides
                <Carousel
                    key={tab}
                    options={{ dragFree: true, loop: places.length > 3 }}
                >
                    {places.map((place) => (
                        <PlaceCard
                            key={place.id}
                            place={place}
                            headingLevel={3}
                            sizes={'(max-width: 768px) 100vw, 420px'}
                        />
                    ))}
                </Carousel>
            ) : (
                <p className={styles.empty}>{t('nothing-here-yet')}</p>
            )}
        </Section>
    )
}
