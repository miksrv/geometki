import React, { useEffect, useMemo, useState } from 'react'
import { Container, Message } from 'simple-react-ui-kit'

import { GetServerSidePropsResult, NextPage } from 'next'
import { useRouter } from 'next/dist/client/router'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiModel, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { AppLayout, PageHeader } from '@/components/shared'
import { SITE_LINK } from '@/config/env'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import { PlaceForm } from '@/sections/place'
import { getErrorMessage, isApiValidationErrors } from '@/utils/api'
import { equalsArrays, parsePlaceId } from '@/utils/helpers'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'

const ConfirmationDialog = dynamic(() => import('@/components/shared/confirmation-dialog/ConfirmationDialog'), {
    ssr: false
})

interface PlaceEditPageProps {
    place?: ApiModel.Place
}

const PlaceEditPage: NextPage<PlaceEditPageProps> = ({ place }) => {
    const { t, i18n } = useTranslation()

    const router = useRouter()

    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')

    const [isDirty, setIsDirty] = useState(false)
    const { allowNavigation, dialogProps: leaveDialogProps } = useUnsavedChangesGuard(isDirty)

    const [updatePlace, { error, isLoading, isSuccess }] = API.usePlacesPatchItemMutation()

    const placeValuesData: ApiType.Places.PostItemRequest = useMemo(
        () => ({
            category: place?.category?.name,
            content: place?.content,
            lat: place?.lat ?? 0,
            lon: place?.lon ?? 0,
            tags: place?.tags,
            title: place?.title
        }),
        [place?.id]
    )

    const validationErrors = useMemo(
        () => (isApiValidationErrors<ApiType.Places.PostItemRequest>(error) ? error.messages : undefined),
        [error]
    )

    const serverError = useMemo(() => (!isApiValidationErrors(error) ? getErrorMessage(error) : undefined), [error])

    // Leaving by Cancel goes through the same unsaved-changes guard as any other navigation
    const handleCancel = () => router.back()

    const handleSubmit = async (formData?: ApiType.Places.PostItemRequest) => {
        const title = formData?.title?.trim()
        const content = formData?.content?.trim()

        await updatePlace({
            ...formData,
            category: formData?.category !== place?.category?.name ? formData?.category : undefined,
            content: content !== place?.content ? content : undefined,
            id: place?.id ?? '',
            tags: !equalsArrays(place?.tags, formData?.tags) ? formData?.tags : undefined,
            title: title !== place?.title ? title : undefined
        })
    }

    useEffect(() => {
        if (isSuccess) {
            setIsDirty(false)
            allowNavigation()
            void router.push(`/places/${place?.id}`)
        }
    }, [isSuccess])

    return (
        <AppLayout>
            <Head>
                {generateNextSeo({
                    nofollow: true,
                    noindex: true,
                    title: `${place?.title} - ${t('editing')}`,
                    description: '',
                    canonical: `${canonicalUrl}places/${place?.id}/edit`
                })}
            </Head>

            <PageHeader
                title={t('editing')}
                breadcrumbs={[
                    { link: '/places', text: t('nav-places', { defaultValue: 'Места' }) },
                    { link: `/places/${place?.id}`, text: place?.title || '' }
                ]}
            />

            <Container>
                {serverError && <Message type={'error'}>{serverError}</Message>}

                <PlaceForm
                    placeId={place?.id}
                    values={placeValuesData}
                    loading={isLoading || isSuccess}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    errors={validationErrors as any}
                    onSubmit={handleSubmit}
                    onCancel={handleCancel}
                    onDirtyChange={setIsDirty}
                />

                <ConfirmationDialog {...leaveDialogProps} />
            </Container>
        </AppLayout>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<PlaceEditPageProps>> => {
            const rawParam = context.params?.id
            const cookies = context.req.cookies
            const locale = (context.locale ?? 'en') as ApiType.Locale
            const translations = await serverSideTranslations(locale)

            if (typeof rawParam !== 'string') {
                return { notFound: true }
            }

            // Tolerate a slugged param (`{id}-{slug}`); the API is always called with the bare id.
            const id = parsePlaceId(rawParam)

            if (!id) {
                return { notFound: true }
            }

            hydrateAuthFromCookies(store, cookies)
            store.dispatch(setLocale(locale))

            const { data: placeData, isError } = await store.dispatch(API.endpoints.placesGetItem.initiate({ id }))

            if (isError) {
                return { notFound: true }
            }

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            return {
                props: {
                    ...translations,
                    place: placeData
                }
            }
        }
)

export default PlaceEditPage
