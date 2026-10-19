import React, { useEffect, useState } from 'react'
import { Button, Container, Message, Spinner } from 'simple-react-ui-kit'

import { GetServerSidePropsResult, NextPage } from 'next'
import { useRouter } from 'next/dist/client/router'
import Head from 'next/head'
import { useSearchParams } from 'next/navigation'
import { useTranslation } from 'next-i18next/pages'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { login } from '@/app/authSlice'
import { useAppDispatch, useAppSelector, wrapper } from '@/app/store'
import { LOCAL_STORAGE } from '@/config/constants'
import useLocalStorage from '@/hooks/useLocalStorage'
import { getErrorMessage } from '@/utils/api'
import * as LocalStorage from '@/utils/localstorage'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'
import { loadPageTranslations } from '@/utils/translations.server'

const AuthPage: NextPage<object> = () => {
    const { t } = useTranslation()

    const dispatch = useAppDispatch()
    const router = useRouter()
    const searchParams = useSearchParams()
    const [returnPath] = useLocalStorage<string>(LOCAL_STORAGE.RETURN_PATH)

    const service = searchParams?.get('service')
    const code = searchParams?.get('code')
    const token = searchParams?.get('token')
    const returnQueryParam = searchParams?.get('return')

    const [isProcessing, setIsProcessing] = useState<boolean>(false)
    const [sendRequest, setSendRequest] = useState<boolean>(false)
    const [isMagicProcessing, setIsMagicProcessing] = useState<boolean>(false)
    const [sendMagicRequest, setSendMagicRequest] = useState<boolean>(false)

    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const [serviceLogin, { data, error, isLoading, isError, isSuccess }] = API.useAuthLoginServiceMutation()

    const [
        verifyMagicLink,
        {
            data: magicData,
            error: magicError,
            isLoading: isMagicLoading,
            isError: isMagicError,
            isSuccess: isMagicSuccess
        }
    ] = API.useAuthVerifyMagicLinkMutation()

    useEffect(() => {
        if (isAuth && !data && !magicData) {
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
        if (magicData?.auth === true && !isMagicProcessing) {
            setIsMagicProcessing(true)
            dispatch(login(magicData))

            const isValidReturn =
                typeof returnQueryParam === 'string' &&
                returnQueryParam.startsWith('/') &&
                !returnQueryParam.includes('://')

            void router.push(isValidReturn ? returnQueryParam : '/')
        }
    }, [magicData])

    useEffect(() => {
        if (token || sendRequest) {
            return
        }

        if (!code || !service) {
            void router.push('/')

            return
        }

        setSendRequest(true)

        void serviceLogin({
            code,
            service: service as ApiType.AuthService,
            state: searchParams?.get('state') ?? undefined,
            device_id: searchParams?.get('device_id') ?? undefined
        })
    }, [])

    useEffect(() => {
        if (!token || sendMagicRequest) {
            return
        }

        setSendMagicRequest(true)
        void verifyMagicLink({ token })
    }, [token])

    const showError = token ? isMagicError && magicError : error
    const showSpinner = token ? isMagicLoading || isMagicSuccess : isLoading || isSuccess
    const showHomeButton = token ? isMagicError : isError

    return (
        <>
            <Head>
                {generateNextSeo({
                    nofollow: true,
                    noindex: true,
                    title: t('authorization-on-site')
                })}
            </Head>

            <div className={'centerPageContainer'}>
                <div className={'wrapper'}>
                    <Container>
                        <h1 className={'header'}>{t('authorization-on-site')}</h1>
                        {showError && (
                            <Message
                                type={'error'}
                                title={t('notification_error')}
                            >
                                {getErrorMessage(token ? magicError : error)}
                            </Message>
                        )}
                        {showSpinner && (
                            <div className={'loaderWrapper'}>
                                <Spinner />
                            </div>
                        )}
                        {showHomeButton && (
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

export default AuthPage
