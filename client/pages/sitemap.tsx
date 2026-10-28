import React from 'react'

import { GetServerSidePropsResult, NextPage } from 'next'

import { API, ApiType } from '@/api'
import { wrapper } from '@/app/store'
import { SITE_LINK } from '@/config/env'
import { buildCollectionUrl, buildPlaceUrl, getLandingFlags } from '@/utils/helpers'

type SitemapDynamicPage = {
    link: string
    update: string
    /** The locales the page exists in: a place untranslated into a locale has no page in it */
    locales?: ApiType.Locale[]
}

const SiteMap: NextPage<object> = () => <></>

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<object>> => {
            const { data, error } = await store.dispatch(API.endpoints.sitemapGetList.initiate())

            if (error) {
                console.error('Sitemap: failed to load places/collections', error)
            }

            // No profiles and no /users: the profile pages are noindex (`UserPage`), a sitemap entry
            // would only ask the crawler to fetch a page it must not index (SEO audit, 2026-10-23)
            const staticPages = ['map', 'places', 'collections']

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            const placesPages: SitemapDynamicPage[] =
                data?.places?.map((place) => ({
                    link: buildPlaceUrl(place.id, place.slug).replace(/^\//, ''),
                    locales: place.locales,
                    update: new Date(place.updated.date).toISOString()
                })) || []

            const collectionsPages: SitemapDynamicPage[] =
                data?.collections?.map((collection) => ({
                    link: buildCollectionUrl(collection.id, collection.slug).replace(/^\//, ''),
                    update: new Date(collection.updated.date).toISOString()
                })) || []

            // Landing pages (features/20-location-seo-pages.md), per flag — the API already
            // only returns indexable (placesCount >= threshold) entries, and a location/pair
            // without a slug yet is skipped: there is no page for it.
            const flags = getLandingFlags()

            const categoryLandingPages: SitemapDynamicPage[] = flags.categories
                ? (data?.categories ?? []).map((item) => ({
                      link: `places/${item.name}`,
                      update: new Date(item.updated.date).toISOString()
                  }))
                : []

            const locationLandingPages: SitemapDynamicPage[] = flags.locations
                ? (data?.locations ?? [])
                      .filter((item) => item.slug)
                      .map((item) => ({
                          link: `places/${item.slug}`,
                          update: new Date(item.updated.date).toISOString()
                      }))
                : []

            const pairLandingPages: SitemapDynamicPage[] = flags.combinations
                ? (data?.locationCategories ?? [])
                      .filter((item) => item.slug)
                      .map((item) => ({
                          link: `places/${item.slug}/${item.category}`,
                          update: new Date(item.updated.date).toISOString()
                      }))
                : []

            const landingPages = [...categoryLandingPages, ...locationLandingPages, ...pairLandingPages]

            // Normalize base URL to always have a trailing slash
            const base = SITE_LINK?.endsWith('/') ? SITE_LINK : `${SITE_LINK}/`

            let sitemap =
                '<?xml version="1.0" encoding="UTF-8"?>' +
                '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'

            const makeHreflang = (ruPath: string, enPath: string) =>
                `<xhtml:link rel="alternate" hreflang="ru" href="${base}${ruPath}"/>` +
                `<xhtml:link rel="alternate" hreflang="en" href="${base}${enPath}"/>` +
                `<xhtml:link rel="alternate" hreflang="x-default" href="${base}${ruPath}"/>`

            const makeUrlNode = (
                url: string,
                date: string,
                freq: 'monthly' | 'daily',
                priority: string,
                hreflang?: string
            ) => `
            <url>
              <loc>${base}${url}</loc>
              <lastmod>${date}</lastmod>
              <changefreq>${freq}</changefreq>
              <priority>${priority}</priority>
              ${hreflang ?? ''}
            </url>
          `

            // Static pages don't have a reliable lastmod — use a fixed date so crawlers don't
            // see them as "just updated" on every request, which wastes crawl budget.
            const STATIC_LASTMOD = '2026-05-26T00:00:00.000Z'

            // The homepage and the feed show the newest places: they change when a place does
            // (ISO strings of one format compare as dates)
            const placesLastmod = placesPages.reduce(
                (latest, page) => (page.update > latest ? page.update : latest),
                STATIC_LASTMOD
            )

            // Homepage
            sitemap += makeUrlNode('', placesLastmod, 'daily', '1.0', makeHreflang('', 'en'))

            // Activity feed: changes all day, like the homepage (its ?type= filters are noindex)
            sitemap += ['activity', 'en/activity']
                .map((url) => makeUrlNode(url, placesLastmod, 'daily', '0.6', makeHreflang('activity', 'en/activity')))
                .join('')

            // Static pages (RU + EN paired with hreflang)
            sitemap += staticPages
                .map((url) => makeUrlNode(url, STATIC_LASTMOD, 'monthly', '0.8', makeHreflang(url, `en/${url}`)))
                .join('')

            sitemap += staticPages
                .map((url) =>
                    makeUrlNode(`en/${url}`, STATIC_LASTMOD, 'monthly', '0.8', makeHreflang(url, `en/${url}`))
                )
                .join('')

            const dynamicPages = [...placesPages, ...landingPages]
            // A page without `locales` exists in both; one in a single locale gets no hreflang pair
            const hasLocale = (page: SitemapDynamicPage, locale: ApiType.Locale) =>
                !page.locales || page.locales.includes(locale)
            const pageHreflang = (page: SitemapDynamicPage) =>
                hasLocale(page, 'ru') && hasLocale(page, 'en') ? makeHreflang(page.link, `en/${page.link}`) : undefined

            // Dynamic pages (RU + EN paired with hreflang)
            sitemap += dynamicPages
                .filter((page) => hasLocale(page, 'ru'))
                .map((page) => makeUrlNode(page.link, page.update, 'daily', '0.7', pageHreflang(page)))
                .join('')

            // Collections: RU only — the /en page stays noindex until an English title exists (phase 3)
            sitemap += collectionsPages.map((page) => makeUrlNode(page.link, page.update, 'daily', '0.7')).join('')

            sitemap += dynamicPages
                .filter((page) => hasLocale(page, 'en'))
                .map((page) => makeUrlNode(`en/${page.link}`, page.update, 'daily', '0.7', pageHreflang(page)))
                .join('')

            sitemap += '</urlset>'

            context.res.setHeader('Content-Type', 'application/xml; charset=UTF-8')
            context.res.write(sitemap)
            context.res.end()

            return {
                props: {}
            }
        }
)

export default SiteMap
