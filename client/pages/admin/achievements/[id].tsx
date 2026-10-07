import React, { useMemo, useState } from 'react'
import { Container } from 'simple-react-ui-kit'

import { GetServerSidePropsResult } from 'next'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { useAppSelector, wrapper } from '@/app/store'
import { AchievementForm } from '@/components/pages/achievement-form'
import { AppLayout, PageHeader } from '@/components/shared'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'

type AchievementInput = ApiType.Achievements.AchievementInput

const ConfirmationDialog = dynamic(() => import('@/components/shared/confirmation-dialog/ConfirmationDialog'), {
    ssr: false
})

interface AdminAchievementsEditProps {
    locale: ApiType.Locale
}

const AdminAchievementsEdit: React.FC<AdminAchievementsEditProps> = () => {
    const { t, i18n } = useTranslation()
    const router = useRouter()
    const achievementId = typeof router.query.id === 'string' ? router.query.id : undefined

    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const { data: manageData } = API.useGetAchievementsManageQuery(undefined, { skip: !isAuth || !achievementId })
    const achievement = manageData?.data?.find((a) => a.id === achievementId)

    const [isDirty, setIsDirty] = useState(false)
    const { allowNavigation, dialogProps: leaveDialogProps } = useUnsavedChangesGuard(isDirty)

    const [updateAchievement, { isLoading: isUpdating }] = API.useUpdateAchievementMutation()
    const [uploadImage, { isLoading: isUploading }] = API.useUploadAchievementImageMutation()

    const form = useMemo<AchievementInput | null>(
        () =>
            achievement
                ? {
                      category: achievement.category,
                      description_en: achievement.description_en ?? '',
                      description_ru: achievement.description_ru ?? '',
                      group_slug: achievement.group_slug ?? '',
                      image: achievement.image,
                      is_active: achievement.is_active,
                      rules: achievement.rules ?? [],
                      season_end: achievement.season_end?.slice(0, 10) ?? null,
                      season_start: achievement.season_start?.slice(0, 10) ?? null,
                      sort_order: achievement.sort_order,
                      tier: achievement.tier,
                      title_en: achievement.title_en,
                      title_ru: achievement.title_ru,
                      type: achievement.type,
                      xp_bonus: achievement.xp_bonus
                  }
                : null,
        [achievement?.id]
    )

    const handleImageUpload = async (file: File) => {
        if (!achievementId) {
            return undefined
        }
        try {
            const result = await uploadImage({ file, id: achievementId }).unwrap()
            return result.image
        } catch {
            // handled by error middleware
            return undefined
        }
    }

    const handleSubmit = async (values: AchievementInput) => {
        if (!achievementId) {
            return
        }
        try {
            await updateAchievement({ body: values, id: achievementId }).unwrap()
            allowNavigation()
            void router.push('/admin/achievements')
        } catch {
            // errors handled by error middleware
        }
    }

    const pageTitle = t('achievements-admin-edit', { defaultValue: 'Редактировать достижение' })

    if (!form) {
        return (
            <AppLayout>
                <Container>
                    <p style={{ padding: '20px', textAlign: 'center' }}>{t('show-more')}</p>
                </Container>
            </AppLayout>
        )
    }

    return (
        <AppLayout>
            <Head>
                {generateNextSeo({
                    title: pageTitle,
                    noindex: true,
                    openGraph: { locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US', title: pageTitle }
                })}
            </Head>

            <PageHeader
                title={pageTitle}
                breadcrumbs={[
                    { link: '/admin/achievements', text: t('achievements-admin-title', { defaultValue: 'Достижения' }) }
                ]}
            />

            <Container>
                <AchievementForm
                    defaultValues={form}
                    isLoading={isUpdating}
                    isUploading={isUploading}
                    onSubmit={handleSubmit}
                    onImageUpload={handleImageUpload}
                    onDirtyChange={setIsDirty}
                />

                <ConfirmationDialog {...leaveDialogProps} />
            </Container>
        </AppLayout>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<AdminAchievementsEditProps>> => {
            const locale = (context.locale ?? 'ru') as ApiType.Locale
            const translations = await serverSideTranslations(locale)

            store.dispatch(setLocale(locale))
            hydrateAuthFromCookies(store, context.req.cookies)

            const { data: authData } = await store.dispatch(API.endpoints.authGetMe.initiate())

            if (authData?.user?.role !== 'admin') {
                return { notFound: true }
            }

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            return { props: { ...translations, locale } }
        }
)

export default AdminAchievementsEdit
