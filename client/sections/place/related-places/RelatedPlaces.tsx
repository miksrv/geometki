import React from 'react'
import { Button } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { ApiModel, ApiType } from '@/api'
import { PlaceCard, Section } from '@/components/shared'
import { Carousel } from '@/components/ui'
import { getCategoryLandingTitle } from '@/utils/categories'
import { buildPlacesHref, getLandingFlags } from '@/utils/helpers'

import styles from './styles.module.sass'

/** Tiles requested for the block (a carousel of three in view) */
export const RELATED_PLACES_COUNT = 4
/** Fewer than this and the block is not worth a heading */
const RELATED_PLACES_MIN = 3

export interface RelatedPlacesLocation {
    id: number
    slug?: string | null
    type: ApiType.LocationTypes
    name?: string
}

interface RelatedPlacesProps {
    places?: ApiModel.PlaceListItem[] | null
    category?: ApiModel.Categories
    location?: RelatedPlacesLocation | null
}

/**
 * "Ещё {категория}: {локация}" — a carousel of four tiles of the same category in the
 * place's region and a link to the location × category landing page
 * (features/20-location-seo-pages.md). The second way out of the page for a guest, next to
 * "Рядом". Hidden with fewer than three.
 */
export const RelatedPlaces: React.FC<RelatedPlacesProps> = ({ places, category, location }) => {
    const { t } = useTranslation()

    if (!category || !places || places.length < RELATED_PLACES_MIN) {
        return null
    }

    const categoryTitle = getCategoryLandingTitle(t, category)
    const categoryLower = categoryTitle.charAt(0).toLocaleLowerCase() + categoryTitle.slice(1)

    const href = buildPlacesHref(
        {
            category,
            defaultOrder: ApiType.SortOrders.DESC,
            defaultSort: ApiType.SortFields.Trending,
            location: location ? { id: location.id, slug: location.slug, type: location.type } : null
        },
        getLandingFlags()
    ).href

    return (
        <Section
            className={styles.section}
            truncateTitle={true}
            title={
                location?.name
                    ? t('related-places-title', {
                          category: categoryLower,
                          location: location.name,
                          defaultValue: 'Ещё {{category}}: {{location}}'
                      })
                    : t('related-places-title-nearby', {
                          category: categoryLower,
                          defaultValue: 'Ещё {{category}} рядом'
                      })
            }
            action={
                <Button
                    mode={'link'}
                    link={href}
                    label={t('related-places-all-short', { defaultValue: 'Все' })}
                />
            }
        >
            <Carousel options={{ dragFree: true, loop: false }}>
                {places.slice(0, RELATED_PLACES_COUNT).map((place) => (
                    <PlaceCard
                        key={place.id}
                        place={place}
                        headingLevel={3}
                        sizes={'(max-width: 768px) 100vw, 300px'}
                    />
                ))}
            </Carousel>
        </Section>
    )
}
