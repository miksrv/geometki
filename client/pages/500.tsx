import React from 'react'

import { GetStaticPropsResult, NextPage } from 'next'
import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { generateNextSeo } from 'next-seo/pages'

import { ErrorPage, getServerErrorTexts } from '@/components/shared/error-page'
import { loadPageTranslations } from '@/utils/translations.server'

/** A page that failed on the server: built once at build time, shown instead of Next's own 500 */
const Error500Page: NextPage = () => {
    const { t } = useTranslation()

    return (
        <>
            <Head>
                {generateNextSeo({
                    noindex: true,
                    nofollow: true,
                    title: t('page-server-error')
                })}
            </Head>

            <ErrorPage
                code={500}
                texts={getServerErrorTexts(t)}
                onAction={() => window.location.reload()}
            />
        </>
    )
}

export const getStaticProps = async (): Promise<GetStaticPropsResult<object>> => {
    const translations = await loadPageTranslations()

    return {
        props: {
            ...translations
        }
    }
}

export default Error500Page
