import React, { useState } from 'react'
import { Button } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel, ApiType } from '@/api'
import { PlaceCard, PlaceCardLoader, Section } from '@/components/shared'
import { ScrollRail, Tabs } from '@/components/ui'
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
 * "Куда поехать": places as a row of tiles that scrolls sideways, with tabs that say how they were picked —
 * the most viewed this week, the newest, the closest. The closest ask for the location only
 * when the visitor presses the button.
 */
export const HomePlaces: React.FC<HomePlacesProps> = ({ popular, latest }) => {
    const { t } = useTranslation()
    const [tab, setTab] = useState<PlacesTab>('popular')

    const tabs: Array<{ key: PlacesTab; label: string }> = [
        { key: 'popular', label: t('home-places-tab-popular') },
        { key: 'new', label: t('home-places-tab-new') },
        { key: 'nearby', label: t('home-places-tab-nearby') }
    ]
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
            ? // TEMPORARILY OFF (1.17.5): no point in the URL, the distance is from the location cookie
              // `/places?lat=${location.lat}&lon=${location.lon}&sort=distance&order=ASC`
              '/places?sort=distance&order=ASC'
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
                tabs={tabs}
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
                // Remounted per tab: a new list starts from its first tile
                <ScrollRail
                    key={tab}
                    variant={'cards'}
                    aria-label={tabs.find(({ key }) => key === tab)?.label}
                    prevLabel={t('scroll-back', 'Назад')}
                    nextLabel={t('scroll-forward', 'Вперёд')}
                >
                    {places.map((place) => (
                        <PlaceCard
                            key={place.id}
                            place={place}
                            headingLevel={3}
                            sizes={'(max-width: 768px) 100vw, 420px'}
                        />
                    ))}
                </ScrollRail>
            ) : (
                <p className={styles.empty}>{t('nothing-here-yet')}</p>
            )}
        </Section>
    )
}
