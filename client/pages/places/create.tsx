import React, { useEffect, useMemo, useState } from 'react'
import { Container, Message } from 'simple-react-ui-kit'

import { GetServerSidePropsResult, NextPage } from 'next'
import { useRouter } from 'next/dist/client/router'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { AppLayout, PageHeader } from '@/components/shared'
import { useConfirmLeave } from '@/hooks/useConfirmLeave'
import { PlaceForm } from '@/sections/place'
import { getErrorMessage, isApiValidationErrors } from '@/utils/api'
import { buildPlaceUrl } from '@/utils/helpers'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'

const ConfirmationDialog = dynamic(() => import('@/components/shared/confirmation-dialog/ConfirmationDialog'), {
    ssr: false
})

const CreatePlacePage: NextPage<object> = () => {
    const { t } = useTranslation()

    const router = useRouter()

    const [clickedButton, setClickedButton] = useState<boolean>(false)
    const [isDirty, setIsDirty] = useState(false)

    const {
        isOpen: leaveDialogOpen,
        handleConfirm: handleLeaveConfirm,
        handleCancel: handleLeaveCancel,
        allowNavigation: allowLeaveNavigation
    } = useConfirmLeave(isDirty)

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
        if (error) {
            setClickedButton(false)
        }
    }, [error])

    useEffect(() => {
        if (data?.id && isSuccess) {
            allowLeaveNavigation()
            void router.push(buildPlaceUrl(data.id))
        } else if (isSuccess) {
            setClickedButton(false)
        }
    }, [isSuccess, data])

    return (
        <AppLayout>
            <Head>
                {generateNextSeo({
                    noindex: true,
                    nofollow: true,
                    title: t('create-geotag')
                })}
            </Head>
            <PageHeader
                title={t('create-geotag')}
                breadcrumbs={[{ link: '/places', text: t('nav-places', { defaultValue: 'Места' }) }]}
            />
            <Container>
                {serverError && <Message type={'error'}>{serverError}</Message>}

                <PlaceForm
                    loading={isLoading || isSuccess || clickedButton}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    errors={validationErrors as any}
                    onSubmit={handleSubmit}
                    onCancel={handleCancel}
                    onDirtyChange={() => setIsDirty(true)}
                />

                <ConfirmationDialog
                    open={leaveDialogOpen}
                    message={t('unsaved-changes-message')}
                    confirmLabel={t('leave-without-saving')}
                    onConfirm={handleLeaveConfirm}
                    onCancel={handleLeaveCancel}
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
