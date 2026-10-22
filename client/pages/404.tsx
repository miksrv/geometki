import React from 'react'

import { GetStaticPropsResult, NextPage } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'
import { generateNextSeo } from 'next-seo/pages'

import { ErrorPage, getNotFoundTexts } from '@/components/shared/error-page'
import { loadPageTranslations } from '@/utils/translations.server'

const Error404Page: NextPage = () => {
    const router = useRouter()
    const { t } = useTranslation()

    return (
        <>
            <Head>
                {generateNextSeo({
                    noindex: true,
                    nofollow: true,
                    title: t('page-not-found')
                })}
            </Head>

            <ErrorPage
                code={404}
                image={'/images/404.png'}
                texts={getNotFoundTexts(t)}
                onAction={() => router.back()}
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

export default Error404Page
