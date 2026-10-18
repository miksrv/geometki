import React from 'react'

import { GetServerSidePropsResult, NextPage } from 'next'
import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { generateNextSeo } from 'next-seo/pages'

import { ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { UnsubscribeForm } from '@/sections/unsubscribe'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'
import { loadPageTranslations } from '@/utils/translations.server'

const UnsubscribePage: NextPage<object> = () => {
    const { t } = useTranslation()

    return (
        <>
            <Head>
                {generateNextSeo({
                    nofollow: true,
                    noindex: true,
                    title: t('unsubscribe-from-email-notifications')
                })}
            </Head>
            <UnsubscribeForm />
        </>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<object>> => {
            const cookies = context.req.cookies
            const locale = (context.locale ?? 'en') as ApiType.Locale
            const translations = await loadPageTranslations()

            hydrateAuthFromCookies(store, cookies)
            store.dispatch(setLocale(locale))

            return {
                props: {
                    ...translations
                }
            }
        }
)

export default UnsubscribePage
