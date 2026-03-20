import React from 'react'
import { Container } from 'simple-react-ui-kit'

import { GetServerSidePropsResult, NextPage } from 'next'
import Image from 'next/image'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { NextSeo } from 'next-seo'

import { API, ApiType } from '@/api'
import { SITE_LINK } from '@/config/env'
import { setLocale } from '@/api/applicationSlice'
import { wrapper } from '@/api/store'
import { AppLayout, Header, UserAvatarGroup } from '@/components/common'
import { levelImage } from '@/functions/userLevels'

interface LevelsPageProps {
    levels: ApiType.Levels.Response | null
}

const LevelsPage: NextPage<LevelsPageProps> = ({ levels }) => {
    const { t, i18n } = useTranslation()

    const canonicalUrl = SITE_LINK + (i18n.language === 'en' ? 'en/' : '')

    return (
        <AppLayout>
            <NextSeo
                title={t('user-levels')}
                canonical={`${canonicalUrl}users/levels`}
                description={t('user-levels-description-1')}
            />
            <Header
                title={t('user-levels')}
                homePageTitle={t('geotags')}
                currentPage={t('user-levels')}
                links={[
                    {
                        link: '/users/',
                        text: t('users')
                    }
                ]}
            />

            <Container style={{ marginTop: 15 }}>
                <p>{t('user-levels-description-1')}</p>
                <p>{t('user-levels-description-2')}</p>
                <h2 style={{ marginBottom: '5px' }}>{t('how-much-experience-for-actions')}</h2>
                <ul className={'normal'}>
                    {levels?.awards &&
                        Object.entries(levels.awards).map(([key, value]) => (
                            <li key={key}>
                                {t(`action_${key}`)}
                                {': '}
                                <strong>{`+${value}`}</strong> {t('experience')}
                            </li>
                        ))}
                </ul>
            </Container>

            <Container
                style={{ marginTop: 15 }}
                className={'levelsPage'}
            >
                {levels?.items?.map((level) => (
                    <div
                        key={`level${level.level}`}
                        className={'levelContainer'}
                    >
                        <div>
                            <div className={'levelTitle'}>
                                {t('level_num', { level: level.level })}
                                <Image
                                    src={levelImage(level.level).src}
                                    alt={''}
                                    width={26}
                                    height={26}
                                />
                                {level.title}
                            </div>
                            <div className={'experience'}>
                                {t('need-experience_num', { experience: level.experience })}
                            </div>
                        </div>
                        <UserAvatarGroup
                            users={level.users}
                            totalCount={level.users?.length && level.count ? level.count - level.users.length : 0}
                        />
                    </div>
                ))}
            </Container>
        </AppLayout>
    )
}

export const getServerSideProps = wrapper.getServerSideProps(
    (store) =>
        async (context): Promise<GetServerSidePropsResult<LevelsPageProps>> => {
            const locale = (context.locale ?? 'en') as ApiType.Locale
            const translations = await serverSideTranslations(locale)

            store.dispatch(setLocale(locale))

            const { data } = await store.dispatch(API.endpoints.levelsGetList.initiate())

            await Promise.all(store.dispatch(API.util.getRunningQueriesThunk()))

            return {
                props: {
                    ...translations,
                    levels: data ?? null
                }
            }
        }
)

export default LevelsPage
