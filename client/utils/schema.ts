import { LocalBusiness, Person } from 'schema-dts'

import { ApiModel } from '@/api'
import { IMG_HOST } from '@/config/env'
import { formatDateISO } from '@/utils/date'
import { buildPlaceUrl } from '@/utils/place'
import { removeMarkdown } from '@/utils/text'

// Categories that represent commercial venues with business hours
const COMMERCIAL_CATEGORIES = new Set<ApiModel.Categories>([ApiModel.Categories.museum])

const getPlaceSchemaType = (category?: ApiModel.Categories): string => {
    if (!category) {
        return 'LocalBusiness'
    }

    return COMMERCIAL_CATEGORIES.has(category) ? 'LocalBusiness' : 'TouristAttraction'
}

export const PlaceSchema = (place: ApiModel.Place, canonicalUrl?: string): unknown | LocalBusiness => ({
    '@context': 'https://schema.org',
    '@type': getPlaceSchemaType(place.category),
    address: {
        '@type': 'PostalAddress',
        addressCountry: place.address?.country?.name,
        addressLocality: place.address?.locality?.name,
        addressRegion: place.address?.region?.name,
        streetAddress: place.address?.street
    },
    ...(place.author
        ? {
              author: {
                  '@type': 'Person',
                  image: place.author.avatar ? `${IMG_HOST}${place.author.avatar}` : undefined,
                  name: place.author.name,
                  url: canonicalUrl ? `${canonicalUrl}users/${place.author.id}` : undefined
              }
          }
        : {}),
    dateModified: formatDateISO(place?.updated?.date),
    datePublished: formatDateISO(place?.created?.date),
    description: removeMarkdown(place.content),
    geo: {
        '@type': 'GeoCoordinates',
        latitude: place.lat,
        longitude: place.lon
    },
    image: place.cover?.full ? `${IMG_HOST}${place.cover.full}` : undefined,
    interactionStatistic: {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/ViewAction',
        userInteractionCount: place.views
    },
    name: place.title,
    // The canonical `{id}-{slug}` URL (a bare id is a 301), and the same `@id` the place page
    // declares on itself, so the entity of a list and the entity of its page are one
    '@id': canonicalUrl ? `${canonicalUrl}${buildPlaceUrl(place.id, place.slug).replace(/^\//, '')}` : undefined,
    url: canonicalUrl ? `${canonicalUrl}${buildPlaceUrl(place.id, place.slug).replace(/^\//, '')}` : undefined
})

export const UserSchema = (user: ApiModel.User, canonicalUrl?: string): unknown | Person => ({
    '@context': 'https://schema.org',
    '@type': 'Person',
    identifier: user.id,
    image: user.avatar ? `${IMG_HOST}${user.avatar}` : undefined,
    name: user.name,
    url: canonicalUrl ? `${canonicalUrl}users/${user.id}` : undefined
})
