import { LocalBusiness, Person } from 'schema-dts'

import { ApiModel } from '@/api'
import { IMG_HOST } from '@/config/env'
import { removeMarkdown } from '@/functions/helpers'

// import { formatDateISO } from '@/functions/helpers'

export const PlaceSchema = (place: ApiModel.Place): unknown | LocalBusiness => ({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    address: {
        '@type': 'PostalAddress',
        addressCountry: place.address?.country?.name,
        addressLocality: place.address?.locality?.name,
        addressRegion: place.address?.region?.name,
        streetAddress: place.address?.street
    },
    // author: {
    //     '@type': 'Person',
    //     image: place?.author?.avatar
    //         ? `${IMG_HOST}${place?.author?.avatar}`
    //         : undefined,
    //     name: place?.author?.name,
    //     url: `${canonicalUrl}users/${place?.author?.id}`
    // },
    // dateModified: formatDateISO(place?.updated?.date),
    // datePublished: formatDateISO(place?.created?.date),
    description: removeMarkdown(place.content),
    geo: {
        '@type': 'GeoCoordinates',
        latitude: place.lat,
        longitude: place.lon
    },
    image: place.cover?.full ? `${IMG_HOST}${place.cover.full}` : undefined,
    interactionStatistic: {
        '@type': 'InteractionCounter',
        userInteractionCount: place.views
    },
    name: place.title
})

export const UserSchema = (user: ApiModel.User): unknown | Person => ({
    '@context': 'https://schema.org',
    '@type': 'Person',
    identifier: user.id,
    image: user.avatar ? `${IMG_HOST}${user.avatar}` : undefined,
    name: user.name
})
