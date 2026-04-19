import React, { useEffect, useState } from 'react'
import { Button, Container, Message, Spinner } from 'simple-react-ui-kit'

import { GetServerSidePropsResult, NextPage } from 'next'
import { useRouter } from 'next/dist/client/router'
import { useSearchParams } from 'next/navigation'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { NextSeo } from 'next-seo'

import { API, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { login } from '@/app/authSlice'
import { useAppDispatch, useAppSelector, wrapper } from '@/app/store'
import { LOCAL_STORAGE } from '@/config/constants'
import useLocalStorage from '@/hooks/useLocalStorage'
import { getErrorMessage } from '@/utils/api'
import * as LocalStorage from '@/utils/localstorage'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'

const AuthPage: NextPage<object> = () => {
    const { t } = useTranslation()

    const dispatch = useAppDispatch()
    const router = useRouter()
    const searchParams = useSearchParams()
    const [returnPath] = useLocalStorage<string>(LOCAL_STORAGE.RETURN_PATH)

    const service = searchParams?.get('service')
    const code = searchParams?.get('code')

    const [isProcessing, setIsProcessing] = useState<boolean>(false)

    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const [serviceLogin, { data, error, isLoading, isError, isSuccess }] = API.useAuthLoginServiceMutation()

    useEffect(() => {
        if (isAuth) {
            void router.push('/')
        }
    }, [isAuth])

    useEffect(() => {
        if (data?.auth === true && !isProcessing) {
            setIsProcessing(true)
            dispatch(login(data))

            if (returnPath) {
                const returnLink = returnPath

                LocalStorage.removeItem(LOCAL_STORAGE.RETURN_PATH as 'RETURN_PATH')

                void router.push(returnLink)
            } else {
                void router.push('/')
            }
        }
    }, [data])

    useEffect(() => {
        if (code && service) {
            void serviceLogin({
                code,
                service: service as ApiType.AuthService,
                state: searchParams?.get('state') ?? undefined,
                device_id: searchParams?.get('device_id') ?? undefined
            })
        } else {
            void router.push('/')
        }
    }, [])

    return (
        <>
            <NextSeo
                nofollow={true}
                noindex={true}
                title={t('authorization-on-site')}
            />

            <div className={'centerPageContainer'}>
                <div className={'wrapper'}>
                    <Container>
                        <h1 className={'header'}>{t('authorization-on-site')}</h1>
                        {error && (
                            <Message
                                type={'error'}
                                title={t('notification_error')}
                            >
                                {getErrorMessage(error)}
                            </Message>
                        )}
                        {(isLoading || isSuccess) && (
                            <div className={'loaderWrapper'}>
                                <Spinner />
                            </div>
                        )}
                        {isError && (
                            <Button
                                style={{ marginTop: 20 }}
                                link={'/'}
                                size={'medium'}
                                mode={'primary'}
                            >
                                {t('go-to-home-page')}
                            </Button>
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

export default AuthPage
