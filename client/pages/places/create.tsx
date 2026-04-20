import React, { useEffect, useMemo, useState } from 'react'
import { Container, Message } from 'simple-react-ui-kit'

import { GetServerSidePropsResult, NextPage } from 'next'
import { useRouter } from 'next/dist/client/router'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { NextSeo } from 'next-seo'

import { API, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { AppLayout, Header } from '@/components/shared'
import { PlaceForm } from '@/sections/place'
import { getErrorMessage, isApiValidationErrors } from '@/utils/api'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'

const CreatePlacePage: NextPage<object> = () => {
    const { t } = useTranslation()

    const router = useRouter()

    const [clickedButton, setClickedButton] = useState<boolean>(false)

    const [createPlace, { data, error, isLoading, isSuccess }] = API.usePlacesPostItemMutation()

    const validationErrors = useMemo(
        () => (isApiValidationErrors<ApiType.Places.PostItemRequest>(error) ? error.messages : undefined),
        [error]
    )

    const serverError = useMemo(() => (!isApiValidationErrors(error) ? getErrorMessage(error) : undefined), [error])

    const handleCancel = () => router.back()

    const handleSubmit = async (formData?: ApiType.Places.PostItemRequest) => {
        if (formData) {
            setClickedButton(true)
            await createPlace(formData)
        }
    }

    useEffect(() => {
        setClickedButton(false)

        if (data?.id && isSuccess) {
            void router.push(`/places/${data.id}`)
        }
    }, [isSuccess, data])

    return (
        <AppLayout>
            <NextSeo
                noindex={true}
                nofollow={true}
                title={t('create-geotag')}
            />
            <Header
                title={t('create-geotag')}
                homePageTitle={t('geotags')}
                currentPage={t('create-geotag')}
                links={[
                    {
                        link: '/places/',
                        text: t('interesting-places')
                    }
                ]}
            />
            <Container>
                {serverError && <Message type={'error'}>{serverError}</Message>}

                <PlaceForm
                    loading={isLoading || isSuccess || clickedButton}
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

export default CreatePlacePage
