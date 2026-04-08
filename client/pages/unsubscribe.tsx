import React, { useEffect } from 'react'
import { Button, Container, Message, Spinner } from 'simple-react-ui-kit'

import { GetServerSidePropsResult, NextPage } from 'next'
import { useRouter } from 'next/dist/client/router'
import { useSearchParams } from 'next/navigation'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { NextSeo } from 'next-seo'

import { API, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { getErrorMessage } from '@/utils/api'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'

const UnsubscribePage: NextPage<object> = () => {
    const { t } = useTranslation()

    const router = useRouter()
    const searchParams = useSearchParams()

    const mailId   = searchParams?.get('mail')
    const digestId = searchParams?.get('digest')

    const { data: mailData, error: mailError, isLoading: mailLoading, isSuccess: mailSuccess, isError: mailIsError } =
        API.useMailGetUnsubscribeQuery(mailId || '', { skip: !mailId })

    const { data: digestData, error: digestError, isLoading: digestLoading, isSuccess: digestSuccess, isError: digestIsError } =
        API.useMailGetUnsubscribeDigestQuery(digestId || '', { skip: !digestId })

    const data      = mailData    ?? digestData
    const error     = mailError   ?? digestError
    const isLoading = mailLoading || digestLoading
    const isSuccess = mailSuccess || digestSuccess
    const isError   = mailIsError || digestIsError

    useEffect(() => {
        if (!mailId && !digestId) {
            void router.push('/')
        }
    }, [])

    return (
        <>
            <NextSeo
                nofollow={true}
                noindex={true}
                title={t('unsubscribe-from-email-notifications')}
            />
            <div className={'centerPageContainer'}>
                <div className={'wrapper'}>
                    <Container>
                        <h1 className={'header'}>{t('unsubscribe-from-email-notifications')}</h1>
                        {error && (
                            <Message
                                type={'error'}
                                title={t('error')}
                            >
                                {getErrorMessage(error)}
                            </Message>
                        )}
                        {data && (
                            <Message
                                type={'success'}
                                title={t('success')}
                            >
                                {data as string}
                            </Message>
                        )}
                        <p className={'description'}>{t('unsubscribe-from-email-notifications-description')}</p>
                        {isLoading && (
                            <div className={'loaderWrapper'}>
                                <Spinner />
                            </div>
                        )}
                        {(isSuccess || isError) && (
                            <Button
                                link={'/'}
                                size={'medium'}
                                mode={'primary'}
                                label={t('go-to-home-page')}
                            />
                        )}
                    </Container>
                </div>
            </div>
        </>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<object>> => {
            const cookies = context.req.cookies
            const locale = (context.locale ?? 'en') as ApiType.Locale
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

export default UnsubscribePage
