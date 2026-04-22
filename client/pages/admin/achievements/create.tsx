import React, { useState } from 'react'
import { Container } from 'simple-react-ui-kit'

import { GetServerSidePropsResult } from 'next'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { NextSeo } from 'next-seo'

import { API, ApiType } from '@/api'
import { setLocale } from '@/app/applicationSlice'
import { useAppSelector, wrapper } from '@/app/store'
import { AchievementForm } from '@/components/pages/achievement-form'
import { AppLayout, Header } from '@/components/shared'
import { hydrateAuthFromCookies } from '@/utils/serverSideAuth'

type AchievementInput = ApiType.Achievements.AchievementInput

const defaultForm: AchievementInput = {
    category: 'exploration',
    description_en: '',
    description_ru: '',
    group_slug: '',
    is_active: true,
    rules: [{ metric: 'places_created', operator: '>=', value: 1 }],
    season_end: null,
    season_start: null,
    sort_order: 0,
    tier: 'none',
    title_en: '',
    title_ru: '',
    type: 'base',
    xp_bonus: 0
}

interface AdminAchievementsCreateProps {
    locale: ApiType.Locale
}

const AdminAchievementsCreate: React.FC<AdminAchievementsCreateProps> = () => {
    const { t, i18n } = useTranslation()
    const router = useRouter()

    const userRole = useAppSelector((state) => state.auth.user?.role)
    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const [form, setForm] = useState<AchievementInput>({ ...defaultForm })
    const [createAchievement, { isLoading }] = API.useCreateAchievementMutation()

    const pageTitle = t('achievements-admin-add', { defaultValue: 'Добавить достижение' })

    const setField = <K extends keyof AchievementInput>(key: K, value: AchievementInput[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }))
    }

    const handleSubmit = async () => {
        try {
            await createAchievement(form).unwrap()
            void router.push('/admin/achievements')
        } catch {
            // errors handled by error middleware
        }
    }

    if (isAuth && userRole && userRole !== 'admin') {
        void router.push('/')
        return null
    }

    return (
        <AppLayout>
            <NextSeo
                title={pageTitle}
                noindex={true}
                openGraph={{ locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US', title: pageTitle }}
            />

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
                    isLoading={isLoading}
                    onFieldChange={setField}
                    onSubmit={handleSubmit}
                />
            </Container>
        </AppLayout>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<AdminAchievementsCreateProps>> => {
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

export default AdminAchievementsCreate
