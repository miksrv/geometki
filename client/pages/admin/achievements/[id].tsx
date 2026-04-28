import React, { useEffect, useState } from 'react'
import { Container } from 'simple-react-ui-kit'

import { GetServerSidePropsResult } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { useAppSelector, wrapper } from '@/app/store'
import { AchievementForm } from '@/components/pages/achievement-form'
import { AppLayout, Header } from '@/components/shared'
import { IMG_HOST } from '@/config/env'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'

type AchievementInput = ApiType.Achievements.AchievementInput

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

    const [form, setForm] = useState<AchievementInput | null>(null)
    const [updateAchievement, { isLoading: isUpdating }] = API.useUpdateAchievementMutation()
    const [uploadImage, { isLoading: isUploading }] = API.useUploadAchievementImageMutation()

    useEffect(() => {
        if (achievement) {
            setForm({
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
            })
        }
    }, [achievement])

    const setField = <K extends keyof AchievementInput>(key: K, value: AchievementInput[K]) => {
        setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !achievementId) {
            return
        }
        try {
            const result = await uploadImage({ file, id: achievementId }).unwrap()
            setField('image', result.image)
        } catch {
            // handled by error middleware
        }
    }

    const handleSubmit = async () => {
        if (!achievementId || !form) {
            return
        }
        try {
            await updateAchievement({ body: form, id: achievementId }).unwrap()
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

            <Header
                title={pageTitle}
                homePageTitle={t('geotags')}
                currentPage={pageTitle}
                links={[
                    { link: '/admin/achievements', text: t('achievements-admin-title', { defaultValue: 'Достижения' }) }
                ]}
            />

            <Container>
                <AchievementForm
                    form={form}
                    isLoading={isUpdating}
                    imageUrl={form.image ? `${IMG_HOST}${form.image}` : null}
                    isUploading={isUploading}
                    onFieldChange={setField}
                    onSubmit={handleSubmit}
                    onImageUpload={handleImageUpload}
                />
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
