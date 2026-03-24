import React from 'react'

import { GetServerSidePropsResult, NextPage } from 'next'

import { API } from '@/api'
import { wrapper } from '@/app/store'
import { SITE_LINK } from '@/config/env'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'

type SitemapDynamicPage = {
    link: string
    update: string
}

const SiteMap: NextPage<object> = () => <></>

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<object>> => {
            const cookies = context.req.cookies
            hydrateAuthFromCookies(store, cookies)

            const { data } = await store.dispatch(API.endpoints.sitemapGetList.initiate())

            const staticPages = ['map', 'places', 'users', 'users/levels', 'categories']

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

            let sitemap =
                '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'

            const makeUrlNode = (url: string, date: string, freq: 'monthly' | 'daily', priority: string = '1.0') => `
            <url>
              <loc>${SITE_LINK}${url}</loc>
              <lastmod>${date}</lastmod>
              <changefreq>${freq}</changefreq>
              <priority>${priority}</priority>
            </url>
          `

            // Homepage (RU and EN)
            sitemap += makeUrlNode('', new Date().toISOString(), 'daily', '1.0')
            sitemap += makeUrlNode('en', new Date().toISOString(), 'daily', '1.0')

            // Static RU Locale
            sitemap += staticPages.map((url) => makeUrlNode(url, new Date().toISOString(), 'monthly', '0.8')).join('')

            // Static EN Locale
            sitemap += staticPages
                .map((url) => makeUrlNode('en/' + url, new Date().toISOString(), 'monthly', '0.8'))
                .join('')

            // Dynamic RU Locale
            sitemap += [...placesPages, ...usersPages]
                .map((page) => makeUrlNode(page.link, page.update, 'daily'))
                .join('')

            // Dynamic EN Locale
            sitemap += [...placesPages, ...usersPages]
                .map((page) => makeUrlNode('en/' + page.link, page.update, 'daily'))
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
