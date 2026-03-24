import React, { useEffect, useMemo } from 'react'
import { Container, Message } from 'simple-react-ui-kit'

import { GetServerSidePropsResult, NextPage } from 'next'
import { useRouter } from 'next/dist/client/router'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { NextSeo } from 'next-seo'

import { API, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch, useAppSelector, wrapper } from '@/app/store'
import { AppLayout, Header } from '@/components/shared'
import { ScreenSpinner } from '@/components/ui'
import { UserForm } from '@/sections/user'
import { getErrorMessage, isApiValidationErrors } from '@/utils/api'

const SettingsUserPage: NextPage<object> = () => {
    const { t } = useTranslation()

    const dispatch = useAppDispatch()
    const router = useRouter()

    const authSlice = useAppSelector((state) => state.auth)

    const { data: userData, isFetching } = API.useUsersGetItemQuery(authSlice.user?.id || '', {
        refetchOnMountOrArgChange: true,
        skip: !authSlice.user?.id
    })

    const [updateProfile, { data, error, isLoading, isSuccess }] = API.useUsersPatchProfileMutation()

    const validationErrors = useMemo(
        () => (isApiValidationErrors<ApiType.Users.PatchRequest>(error) ? error.messages : undefined),
        [error]
    )

    const serverError = useMemo(() => (!isApiValidationErrors(error) ? getErrorMessage(error) : undefined), [error])

    const handleCancel = () => {
        router.back()
    }

    const handleSubmit = async (formData?: ApiType.Users.PatchRequest) => {
        await updateProfile({
            id: authSlice.user?.id,
            name: formData?.name !== userData?.name ? formData?.name : undefined,
            newPassword:
                userData?.authType === 'native' && formData?.newPassword && formData.newPassword.length > 1
                    ? formData.newPassword
                    : undefined,
            oldPassword:
                userData?.authType === 'native' && formData?.oldPassword && formData.oldPassword.length > 1
                    ? formData.oldPassword
                    : undefined,
            settings: formData?.settings,
            website: formData?.website !== userData?.website ? formData?.website : undefined
        })
    }

    useEffect(() => {
        if (authSlice.isAuth === false) {
            void router.push('/users')
        }
    }, [authSlice?.isAuth])

    useEffect(() => {
        if (isSuccess) {
            void router.replace(`/users/${authSlice.user?.id}`)

            void dispatch(
                Notify({
                    id: 'userFormSuccess',
                    title: '',
                    message: t('settings-have-been-saved'),
                    type: 'success'
                })
            )
        }
    }, [isSuccess, data])

    return (
        <AppLayout>
            <NextSeo
                noindex={true}
                nofollow={true}
                title={t('settings')}
            />
            <Header
                title={t('settings')}
                homePageTitle={t('geotags')}
                currentPage={t('settings')}
                backLink={`/users/${authSlice.user?.id}`}
                links={[
                    {
                        link: '/users/',
                        text: t('users')
                    },
                    {
                        link: `/users/${authSlice.user?.id}`,
                        text: authSlice.user?.name || t('my-page')
                    }
                ]}
            />
            <Container style={{ marginTop: 15 }}>
                {!authSlice.isAuth && <ScreenSpinner />}

                {serverError && (
                    <Message
                        type={'error'}
                        style={{ marginBottom: 15 }}
                    >
                        {serverError}
                    </Message>
                )}

                <UserForm
                    loading={isLoading || isSuccess || isFetching}
                    values={userData}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    errors={validationErrors as any}
                    onSubmit={handleSubmit}
                    onCancel={handleCancel}
                />
            </Container>
        </AppLayout>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<object>> => {
            const locale = (context.locale ?? 'en') as ApiType.Locale
            const translations = await serverSideTranslations(locale)

            store.dispatch(setLocale(locale))

            return {
                props: {
                    ...translations
                }
            }
        }
)

export default SettingsUserPage
