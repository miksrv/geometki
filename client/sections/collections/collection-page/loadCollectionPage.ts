import type { ParsedUrlQuery } from 'querystring'

import { API, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import type { AppStore } from '@/app/store'
import { buildCollectionUrl, encodeQueryData, parseCollectionId } from '@/utils/helpers'
import { loadPageTranslations } from '@/utils/translations.server'

import type { CollectionPageProps } from './CollectionPage'

export type CollectionPageResult =
    | { props: CollectionPageProps }
    | { notFound: true }
    | { redirect: { destination: string; statusCode: 301 } }

interface LoadCollectionPageOptions {
    /** The route param: the bare id or `{id}-{slug}` */
    param?: string | string[]
    locale?: string
    /** Kept on the redirect to the canonical URL (a live render: the cached one has no query) */
    query?: ParsedUrlQuery
}

/**
 * The data of a collection page, for both of its routes: the cached one of guests
 * (`pages/collections/[id]/index.tsx`) and the per-request one of a signed-in user
 * (`pages/live/collections/[id].tsx`, which also shows them their hidden collection). Server only.
 *
 * Throws when the API fails on anything but a missing collection: a cached page then stays as
 * it was, a live one is a server error instead of a misleading 404.
 */
export const loadCollectionPage = async (
    store: AppStore,
    { param, locale: contextLocale, query = {} }: LoadCollectionPageOptions
): Promise<CollectionPageResult> => {
    const rawParam = typeof param === 'string' ? param : undefined
    const locale = (contextLocale ?? 'en') as ApiType.Locale
    const translations = await loadPageTranslations()

    const id = rawParam ? parseCollectionId(rawParam) : undefined

    if (!rawParam || !id) {
        return { notFound: true }
    }

    store.dispatch(setLocale(locale))

    const { data, error } = await store.dispatch(API.endpoints.collectionsGetItem.initiate(id))

    if (error) {
        if ('status' in error && error.status === 404) {
            return { notFound: true }
        }

        throw new Error(`Failed to load collection ${id}: ${JSON.stringify(error)}`)
    }

    const canonicalParam = data?.slug ? `${id}-${data.slug}` : id

    if (rawParam !== canonicalParam) {
        const localePrefix = locale === 'en' ? '/en' : ''
        const rest = { ...query }
        delete rest.id

        return {
            redirect: {
                destination: `${localePrefix}${buildCollectionUrl(id, data?.slug)}${encodeQueryData(rest)}`,
                // Permanent (301) redirect: the canonical `{id}-{slug}` URL never changes for a
                // given collection, so search engines (Yandex in particular) should consolidate
                // ranking signals onto it instead of re-crawling the old URL as a separate page.
                statusCode: 301
            }
        }
    }

    await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

    return { props: { ...translations, collection: data, id } }
}
