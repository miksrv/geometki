import React, { useEffect, useMemo, useState } from 'react'
import { Container, Message, Spinner } from 'simple-react-ui-kit'

import { GetServerSidePropsResult, NextPage } from 'next'
import { useRouter } from 'next/dist/client/router'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { wrapper } from '@/app/store'
import { displayName } from '@/components/map/osm-candidates/utils'
import { AppLayout, PageHeader } from '@/components/shared'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import { PlaceForm } from '@/sections/place'
import { getErrorMessage, isApiValidationErrors } from '@/utils/api'
import { buildPlaceUrl } from '@/utils/helpers'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'

const ConfirmationDialog = dynamic(() => import('@/components/shared/confirmation-dialog/ConfirmationDialog'), {
    ssr: false
})

const CreatePlacePage: NextPage<object> = () => {
    const { t, i18n } = useTranslation()

    const router = useRouter()

    // Created from an OSM candidate on the map: the form is prefilled and the candidate gets linked
    const candidateId = typeof router.query.candidate === 'string' ? router.query.candidate : undefined

    const { data: candidate, isLoading: candidateLoading } = API.useOsmCandidatesGetItemQuery(candidateId ?? '', {
        skip: !candidateId
    })

    const candidateValues = useMemo<ApiType.Places.PostItemRequest | undefined>(
        () =>
            candidate
                ? {
                      category: candidate.category ?? undefined,
                      lat: candidate.lat,
                      lon: candidate.lon,
                      title: displayName(t, candidate, i18n.language)
                  }
                : undefined,
        [candidate]
    )

    const [clickedButton, setClickedButton] = useState<boolean>(false)
    const [isDirty, setIsDirty] = useState(false)

    const { allowNavigation, dialogProps: leaveDialogProps } = useUnsavedChangesGuard(isDirty)

    const [createPlace, { data, error, isLoading, isSuccess }] = API.usePlacesPostItemMutation()

    const validationErrors = useMemo(
        () => (isApiValidationErrors<ApiType.Places.PostItemRequest>(error) ? error.messages : undefined),
        [error]
    )

    const serverError = useMemo(() => (!isApiValidationErrors(error) ? getErrorMessage(error) : undefined), [error])

    // Leaving by Cancel goes through the same unsaved-changes guard as any other navigation
    const handleCancel = () => router.back()

    const handleSubmit = async (formData?: ApiType.Places.PostItemRequest) => {
        if (formData) {
            setClickedButton(true)
            await createPlace(candidate?.status === 'open' ? { ...formData, candidate: candidate.id } : formData)
        }
    }

    useEffect(() => {
        if (error) {
            setClickedButton(false)
        }
    }, [error])

    useEffect(() => {
        if (data?.id && isSuccess) {
            allowNavigation()
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

                {/* Taken since the map was opened: somebody created the place, or it was there already */}
                {candidate?.place && candidate.status !== 'open' && (
                    <Message type={'warning'}>
                        {candidate.status === 'linked'
                            ? t('osm-candidates_create-taken', { defaultValue: 'Это место уже есть на Геометках:' })
                            : t('osm-candidates_create-duplicate', {
                                  defaultValue: 'Похоже, это место уже есть на Геометках:'
                              })}{' '}
                        <Link href={buildPlaceUrl(candidate.place.id)}>
                            {candidate.place.title ?? candidate.place.id}
                        </Link>
                    </Message>
                )}

                {candidate && (
                    <Message type={'info'}>
                        {t('osm-candidates_create-hint', {
                            defaultValue:
                                'Название, категория и координаты взяты из OpenStreetMap, проверьте их. Описание напишите своими словами: копировать тексты из Википедии нельзя.'
                        })}
                    </Message>
                )}

                {candidateId && candidateLoading ? (
                    <Spinner />
                ) : (
                    <PlaceForm
                        // A new form once the candidate is loaded: its values are the form's defaults
                        key={candidate?.id ?? 'new'}
                        values={candidateValues}
                        loading={isLoading || isSuccess || clickedButton}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        errors={validationErrors as any}
                        onSubmit={handleSubmit}
                        onCancel={handleCancel}
                        onDirtyChange={setIsDirty}
                    />
                )}

                <ConfirmationDialog {...leaveDialogProps} />
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
