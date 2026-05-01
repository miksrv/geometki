import React from 'react'
import { Button, Container } from 'simple-react-ui-kit'

import type { GetServerSidePropsResult, NextPage } from 'next'
import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { generateNextSeo } from 'next-seo/pages'

import { ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { AppLayout } from '@/components/shared'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'

const CatchAllPage: NextPage<object> = () => {
    const { t } = useTranslation()

    return (
        <AppLayout>
            <Head>
                {generateNextSeo({
                    nofollow: true,
                    noindex: true,
                    title: t('page-not-found')
                })}
            </Head>

            <Container className={'container404'}>
                <span className={'code404'}>{'404'}</span>
                <p className={'description404'}>{t('page-not-found-description')}</p>
                <Button
                    mode={'primary'}
                    size={'medium'}
                    link={'/'}
                    label={t('go-to-home-page')}
                />
            </Container>
        </AppLayout>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<object>> => {
            const cookies = context.req.cookies
            const locale = (context.locale ?? 'ru') as ApiType.Locale
            const translations = await serverSideTranslations(locale)

            hydrateAuthFromCookies(store, cookies)
            store.dispatch(setLocale(locale))

            return {
                props: {
                    ...translations
                }
            }
        }
)

export default CatchAllPage
