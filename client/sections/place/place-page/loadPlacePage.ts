import type { ParsedUrlQuery } from 'querystring'

import { API, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import type { AppStore } from '@/app/store'
import { IN_COLLECTIONS_LIMIT } from '@/sections/collections'
import type { RelatedPlacesLocation } from '@/sections/place'
import { RELATED_PLACES_COUNT } from '@/sections/place/place-explore'
import { buildPlaceUrl, encodeQueryData, parsePlaceId } from '@/utils/helpers'
import { dropFromHydration } from '@/utils/hydration'
import { renderMarkdown } from '@/utils/markdown.server'
import { loadPageTranslations } from '@/utils/translations.server'

import type { PlacePageProps } from './PlacePage'

const NEAR_PLACES_COUNT = 10

export type PlacePageResult =
    { props: PlacePageProps } | { notFound: true } | { redirect: { destination: string; statusCode: 301 } }

interface LoadPlacePageOptions {
    /** The route param: the bare id or `{id}-{slug}` */
    param?: string | string[]
    locale?: string
    /** The visitor's point (a signed-in user's render), for the distance to the place */
    visitorLocation?: ApiType.Coordinates
    /** Kept on the redirect to the canonical URL (a live render: the cached one has no query) */
    query?: ParsedUrlQuery
}

/**
 * The data of the place page, for both of its routes: the cached one of guests and crawlers
 * (getStaticProps) and the per-request one of a signed-in user (getServerSideProps, after
 * `hydrateAuthFromCookies`). Server only: import it by this path, never from a barrel.
 *
 * Throws when the API fails on anything but a missing place: a cached page then stays as it
 * was, instead of turning into a 404 for a place that exists.
 */
export const loadPlacePage = async (
    store: AppStore,
    { param, locale: contextLocale, visitorLocation, query = {} }: LoadPlacePageOptions
): Promise<PlacePageResult> => {
    const rawParam = typeof param === 'string' ? param : undefined
    const locale = (contextLocale ?? 'en') as ApiType.Locale
    // Started now, awaited with the data: a local file read, but a serial one otherwise.
    // The no-op catch keeps an early 404/301 return from leaving an unhandled rejection.
    const translationsPromise = loadPageTranslations()
    translationsPromise.catch(() => undefined)

    // The route param may be the bare id or the SEO-friendly `{id}-{slug}` form; the
    // API itself is always called with the bare id.
    const id = rawParam ? parsePlaceId(rawParam) : undefined

    if (!rawParam || !id) {
        return { notFound: true }
    }

    store.dispatch(setLocale(locale))

    const placeRequest = store.dispatch(API.endpoints.placesGetItem.initiate({ id, ...visitorLocation }))
    const { data: placeData, error } = await placeRequest

    if (error) {
        if ('status' in error && error.status === 404) {
            return { notFound: true }
        }

        throw new Error(`Place ${id} not loaded: ${JSON.stringify(error)}`)
    }

    // Redirect to the canonical `{id}` / `{id}-{slug}` URL when the requested param
    // doesn't match it (missing slug, stale slug, or a bare id for a place that now has
    // one). An empty/missing slug always canonicalises to the bare id, so this cannot loop.
    const canonicalParam = placeData?.slug ? `${id}-${placeData.slug}` : id

    if (rawParam !== canonicalParam) {
        const localePrefix = locale === 'en' ? '/en' : ''
        const rest = { ...query }
        delete rest.id

        return {
            redirect: {
                destination: `${localePrefix}${buildPlaceUrl(id, placeData?.slug)}${encodeQueryData(rest)}`,
                // Permanent (301) redirect: the canonical `{id}-{slug}` URL never changes for a
                // given place, so search engines (Yandex in particular) should consolidate
                // ranking signals onto it instead of re-crawling the old URL as a separate page.
                statusCode: 301
            }
        }
    }

    // "Ещё {category}: {region}": the place's region, or nothing (then the block is hidden)
    const relatedLocation: RelatedPlacesLocation | null =
        placeData?.category && placeData.address?.region?.id
            ? {
                  id: placeData.address.region.id,
                  name: placeData.address.region.name,
                  slug: placeData.address.region.slug,
                  type: 'region'
              }
            : null

    // One round trip for everything the page shows: the related list is requested with
    // room for the nearby places and filtered here instead of waiting for their ids;
    // the sidebar blocks (visited, collections) and the history count are prefetched so
    // they are in the HTML instead of popping in after hydration. The place, its photos and
    // the lists go to the page as props, no hook asks for them: dropped from the hydrated store
    const photosRequest = store.dispatch(API.endpoints.photosGetList.initiate({ place: id }))
    const nearRequest = store.dispatch(
        API.endpoints.placesGetList.initiate({
            excludePlaces: [id],
            lat: placeData?.lat,
            limit: NEAR_PLACES_COUNT,
            lon: placeData?.lon,
            order: ApiType.SortOrders.ASC,
            sort: ApiType.SortFields.Distance
        })
    )
    const relatedRequest = relatedLocation
        ? store.dispatch(
              API.endpoints.placesGetList.initiate({
                  category: placeData?.category,
                  excludePlaces: [id],
                  lat: placeData?.lat,
                  limit: RELATED_PLACES_COUNT + NEAR_PLACES_COUNT,
                  lon: placeData?.lon,
                  order: ApiType.SortOrders.ASC,
                  region: relatedLocation.id,
                  sort: ApiType.SortFields.Distance
              })
          )
        : undefined

    const [{ data: ratingData }, { data: photosData }, { data: nearPlaces }, related, , , , , translations] =
        await Promise.all([
            store.dispatch(API.endpoints.ratingGetList.initiate(id)),
            photosRequest,
            nearRequest,
            relatedRequest,
            store.dispatch(API.endpoints.commentsGetList.initiate({ place: id })),
            store.dispatch(API.endpoints.visitsGetList.initiate({ limit: 1, place: id })),
            store.dispatch(API.endpoints.collectionsGetList.initiate({ limit: IN_COLLECTIONS_LIMIT, placeId: id })),
            store.dispatch(API.endpoints.feedGetStories.initiate({ countOnly: true, place: id })),
            translationsPromise
        ])
    const relatedData = related?.data

    await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

    dropFromHydration(store, placeRequest, photosRequest, nearRequest, relatedRequest)

    const nearIds = new Set(nearPlaces?.items?.map((item) => item.id) ?? [])
    const relatedPlaces = relatedData?.items?.filter((item) => !nearIds.has(item.id)).slice(0, RELATED_PLACES_COUNT)

    return {
        props: {
            ...translations,
            contentHtml: renderMarkdown(placeData?.content),
            nearPlaces: nearPlaces?.items ?? null,
            photoList: photosData?.items,
            place: placeData,
            ratingCount: ratingData?.count ?? 0,
            relatedLocation,
            relatedPlaces: relatedPlaces ?? null
        }
    }
}
