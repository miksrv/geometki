import React, { useState } from 'react'
import { Button } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { ApiModel, ApiType } from '@/api'
import { PlaceCard, Section } from '@/components/shared'
import { Carousel, Tabs } from '@/components/ui'
import { getCategoryLandingTitle } from '@/utils/categories'
import { buildPlacesHref, getLandingFlags } from '@/utils/helpers'

import styles from './styles.module.sass'

/** Tiles requested for the "same category in the region" tab */
export const RELATED_PLACES_COUNT = 8
/** Fewer than this and the tab is not worth it */
const RELATED_PLACES_MIN = 3

export interface RelatedPlacesLocation {
    id: number
    slug?: string | null
    type: ApiType.LocationTypes
    name?: string
}

type ExploreTab = 'nearby' | 'related'

interface PlaceExploreProps {
    /** The closest places, by distance */
    nearPlaces?: ApiModel.PlaceListItem[] | null
    /** The same category in the place's region, without the nearby ones */
    relatedPlaces?: ApiModel.PlaceListItem[] | null
    category?: ApiModel.Categories
    location?: RelatedPlacesLocation | null
    lat?: number
    lon?: number
}

/**
 * "Что ещё посмотреть" — the answer to "where next": a carousel of place tiles with a switch
 * between the nearest places and the same category in the place's region (with the link to
 * that location × category landing page, features/20-location-seo-pages.md). Both lists stay
 * in the HTML, the inactive one hidden: they are the internal links of the page for crawlers.
 * A tab with too few places is dropped; with no places at all the section is not rendered.
 */
export const PlaceExplore: React.FC<PlaceExploreProps> = ({
    nearPlaces,
    relatedPlaces,
    category,
    location,
    lat,
    lon
}) => {
    const { t } = useTranslation()

    const hasNearby = !!nearPlaces?.length
    const hasRelated = !!category && (relatedPlaces?.length ?? 0) >= RELATED_PLACES_MIN

    const [activeTab, setActiveTab] = useState<ExploreTab>(hasNearby ? 'nearby' : 'related')

    if (!hasNearby && !hasRelated) {
        return null
    }

    const categoryTitle = category ? getCategoryLandingTitle(t, category) : ''

    const relatedHref = category
        ? buildPlacesHref(
              {
                  category,
                  defaultOrder: ApiType.SortOrders.DESC,
                  defaultSort: ApiType.SortFields.Trending,
                  location: location ? { id: location.id, slug: location.slug, type: location.type } : null
              },
              getLandingFlags()
          ).href
        : undefined

    const tabs = [
        ...(hasNearby ? [{ key: 'nearby' as const, label: t('nearby-places-title', { defaultValue: 'Рядом' }) }] : []),
        ...(hasRelated
            ? [
                  {
                      key: 'related' as const,
                      label: location?.name
                          ? t('related-places-tab', {
                                category: categoryTitle,
                                location: location.name,
                                defaultValue: '{{category}} · {{location}}'
                            })
                          : categoryTitle
                  }
              ]
            : [])
    ]

    const carousel = (places: ApiModel.PlaceListItem[]) => (
        <Carousel options={{ dragFree: true, loop: false }}>
            {places.map((place) => (
                <PlaceCard
                    key={place.id}
                    place={place}
                    headingLevel={3}
                    sizes={'(max-width: 768px) 80vw, 300px'}
                />
            ))}
        </Carousel>
    )

    return (
        <Section
            className={styles.section}
            title={t('place-explore-title', { defaultValue: 'Что ещё посмотреть' })}
            action={
                activeTab === 'nearby' ? (
                    <Button
                        mode={'link'}
                        noIndex={true}
                        link={`/places?lat=${lat}&lon=${lon}&sort=distance&order=ASC`}
                        label={t('all-places-nearby')}
                    />
                ) : (
                    <Button
                        mode={'link'}
                        link={relatedHref}
                        label={t('related-places-all-short', { defaultValue: 'Все' })}
                    />
                )
            }
        >
            {tabs.length > 1 && (
                <Tabs<ExploreTab>
                    className={styles.tabs}
                    tabs={tabs}
                    activeTab={activeTab}
                    aria-label={t('place-explore-title', { defaultValue: 'Что ещё посмотреть' })}
                    onChangeTab={(key) => key && setActiveTab(key)}
                />
            )}

            {hasNearby && <div hidden={activeTab !== 'nearby'}>{carousel(nearPlaces!)}</div>}

            {hasRelated && (
                <div hidden={activeTab !== 'related'}>{carousel(relatedPlaces!.slice(0, RELATED_PLACES_COUNT))}</div>
            )}
        </Section>
    )
}
