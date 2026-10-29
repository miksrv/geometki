import { LocalBusiness, Person } from 'schema-dts'

import { ApiModel } from '@/api'
import { IMG_HOST } from '@/config/env'
import { buildPlaceUrl } from '@/utils/place'
import { removeMarkdown } from '@/utils/text'

// Categories that represent commercial venues with business hours
const COMMERCIAL_CATEGORIES = new Set<ApiModel.Categories>([ApiModel.Categories.museum])

/**
 * A spring, a ruin or a summit is a `TouristAttraction`, not a business with opening hours and
 * stars: `LocalBusiness` only for the commercial categories (SEO audit, 2026-10-23: every place
 * page used to declare both, with an `aggregateRating` that reads as review spam on nature)
 */
export const getPlaceSchemaType = (category?: ApiModel.Categories): 'LocalBusiness' | 'TouristAttraction' =>
    category && COMMERCIAL_CATEGORIES.has(category) ? 'LocalBusiness' : 'TouristAttraction'

/**
 * Google takes a rating (Review snippets) only on a few types, `LocalBusiness` among them and
 * `TouristAttraction` not: on a spring or a summit it is the "Invalid object type for field
 * <parent_node>" error of Search Console. So the stars go only on the commercial categories
 */
export const buildPlaceRating = (category?: ApiModel.Categories, rating?: number, ratingCount?: number) =>
    ratingCount && rating && getPlaceSchemaType(category) === 'LocalBusiness'
        ? {
              '@type': 'AggregateRating',
              bestRating: '5',
              ratingCount,
              ratingValue: String(rating),
              worstRating: '1'
          }
        : undefined

/**
 * The geocoder puts a road number (`80К-007`, `Р-240`, `М-5`) into `street` for a place by a
 * highway; a street name has a lowercase letter in it, a road code never does
 */
export const isStreetName = (street?: string): street is string => !!street && /\p{Ll}/u.test(street)

export const buildPlaceAddress = (address?: ApiModel.Address) => ({
    '@type': 'PostalAddress',
    addressCountry: address?.country?.name ? { '@type': 'Country', name: address.country.name } : undefined,
    addressLocality: address?.locality?.name,
    addressRegion: address?.region?.name,
    streetAddress: isStreetName(address?.street) ? address.street : undefined
})

export const PlaceSchema = (place: ApiModel.Place, canonicalUrl?: string): unknown | LocalBusiness => ({
    '@context': 'https://schema.org',
    '@type': getPlaceSchemaType(place.category),
    address: buildPlaceAddress(place.address),
    // No author and dates: they are CreativeWork properties, a place is not one (the place page
    // puts them on its `WebPage` node)
    description: removeMarkdown(place.content) || undefined,
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
