import React from 'react'

import { GetServerSidePropsResult, NextPage } from 'next'

import { API } from '@/api'
import { wrapper } from '@/app/store'
import { SITE_LINK } from '@/config/env'

type SitemapDynamicPage = {
    link: string
    update: string
}

const SiteMap: NextPage<object> = () => <></>

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<object>> => {
            const { data } = await store.dispatch(API.endpoints.sitemapGetList.initiate())

            const staticPages = ['map', 'places', 'users', 'users/levels', 'categories', 'tags']

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            const placesPages: SitemapDynamicPage[] =
                data?.places?.map((place) => ({
                    link: `places/${place.id}`,
                    update: new Date(place.updated.date).toISOString()
                })) || []

            const usersPages: SitemapDynamicPage[] =
                data?.users?.map((user) => ({
                    link: `users/${user.id}`,
                    update: new Date(user.updated.date).toISOString()
                })) || []

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
            const STATIC_LASTMOD = '2025-01-01T00:00:00.000Z'

            // Homepage
            sitemap += makeUrlNode('', STATIC_LASTMOD, 'daily', '1.0', makeHreflang('', 'en'))

            // Static pages (RU + EN paired with hreflang)
            sitemap += staticPages
                .map((url) => makeUrlNode(url, STATIC_LASTMOD, 'monthly', '0.8', makeHreflang(url, `en/${url}`)))
                .join('')

            sitemap += staticPages
                .map((url) =>
                    makeUrlNode(`en/${url}`, STATIC_LASTMOD, 'monthly', '0.8', makeHreflang(url, `en/${url}`))
                )
                .join('')

            // Dynamic pages (RU + EN paired with hreflang)
            sitemap += [...placesPages, ...usersPages]
                .map((page) =>
                    makeUrlNode(page.link, page.update, 'daily', '0.7', makeHreflang(page.link, `en/${page.link}`))
                )
                .join('')

            sitemap += [...placesPages, ...usersPages]
                .map((page) =>
                    makeUrlNode(
                        `en/${page.link}`,
                        page.update,
                        'daily',
                        '0.7',
                        makeHreflang(page.link, `en/${page.link}`)
                    )
                )
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
