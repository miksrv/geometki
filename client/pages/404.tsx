import React from 'react'
import { Button, Container } from 'simple-react-ui-kit'

import type { GetStaticPropsResult, NextPage } from 'next'
import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { generateNextSeo } from 'next-seo/pages'

import { AppLayout } from '@/components/shared'

const NotFoundPage: NextPage<object> = () => {
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

export const getStaticProps = async (context: { locale?: string }): Promise<GetStaticPropsResult<object>> => {
    const locale = context.locale ?? 'ru'
    const translations = await serverSideTranslations(locale)

    return {
        props: {
            ...translations
        }
    }
}

export default NotFoundPage
