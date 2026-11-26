import React, { useState } from 'react'
import { Button, cn } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel, ApiType } from '@/api'
import { PlaceCard, PlaceCardLoader, Section } from '@/components/shared'
import { ScrollRail, Tabs } from '@/components/ui'
import useUserLocation from '@/hooks/useUserLocation'

import styles from './styles.module.sass'

type PlacesTab = 'recommended' | 'popular' | 'new' | 'nearby'

/** As many as the server sends for the other two tabs */
const NEARBY_LIMIT = 8

interface HomePlacesProps {
    popular?: ApiModel.Place[]
    latest?: ApiModel.Place[]
    /**
     * A signed-in user's own list (the home page's "for you"): the places picked by their
     * interests that they have not explored. With it the first tab is "Для вас" instead of the
     * week's popular ones, the nearby ones come second and leave out the explored places too.
     */
    recommended?: ApiModel.Place[]
}

/**
 * "Куда поехать": places as a row of tiles that scrolls sideways, with tabs that say how they were picked —
 * the most viewed this week, the newest, the closest; for a signed-in user (`recommended`) —
 * picked for them, the closest, the newest, without the places they explored. The closest ask
 * for the location only when the visitor presses the button.
 */
export const HomePlaces: React.FC<HomePlacesProps> = ({ popular, latest, recommended }) => {
    const { t } = useTranslation()
    const personal = !!recommended
    const [tab, setTab] = useState<PlacesTab>(personal ? 'recommended' : 'popular')

    const tabs: Array<{ key: PlacesTab; label: string }> = personal
        ? [
              { key: 'recommended', label: t('home-places-tab-recommended') },
              { key: 'nearby', label: t('home-places-tab-nearby') },
              { key: 'new', label: t('home-places-tab-new') }
          ]
        : [
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
            // A signed-in user's nearby places are the ones still to explore
            notVisited: personal ? 1 : undefined,
            order: ApiType.SortOrders.ASC,
            sort: ApiType.SortFields.Distance
        },
        { skip: tab !== 'nearby' || !location }
    )

    const places =
        tab === 'recommended' ? recommended : tab === 'popular' ? popular : tab === 'new' ? latest : nearbyData?.items

    const allLink =
        tab === 'nearby' && location
            ? // TEMPORARILY OFF (1.17.5): no point in the URL, the distance is from the location cookie
              // `/places?lat=${location.lat}&lon=${location.lon}&sort=distance&order=ASC`
              '/places?sort=distance&order=ASC'
            : tab === 'new'
              ? '/places?sort=created_at'
              : tab === 'recommended'
                ? '/places?sort=recommended'
                : '/places?sort=views_week'

    return (
        <Section
            title={t('home-places-title')}
            action={
                <Button
                    mode={'link'}
                    noIndex={tab === 'nearby' || tab === 'recommended'}
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
                // The same dashed plate as the invitation to share the location, the words in the middle
                <div className={cn(styles.locate, styles.empty)}>
                    <p>{tab === 'recommended' ? t('home-places-recommended-empty') : t('nothing-here-yet')}</p>
                </div>
            )}
        </Section>
    )
}
