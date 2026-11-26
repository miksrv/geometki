import React from 'react'
import { Button } from 'simple-react-ui-kit'

import type { NextPage } from 'next'
import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { generateNextSeo } from 'next-seo/pages'

import { API, ApiType } from '@/api'
import { useAppSelector } from '@/app/store'
import { AppLayout, Section } from '@/components/shared'
import { SITE_LINK } from '@/config/env'
import { formatLength, formatWalkTime, questCoverSrc, questHref, walkMinutes } from '@/utils/game'
import { truncateText } from '@/utils/helpers'

import { QuestHero } from './QuestHero'
import { QuestHowTo } from './QuestHowTo'
import { QuestMap } from './QuestMap'
import { QuestSteps } from './QuestSteps'
import { useQuestConfirm } from './useQuestConfirm'

import styles from './styles.module.sass'

export interface QuestPageProps {
    id: string
    quest?: ApiType.Game.QuestResponse
}

/**
 * A quest (DESIGN.md → Quests → Quest page), an archetype of its own — a quest to walk, not a
 * page to read, and the page a link in a messenger opens. One column, by where the visitor is
 * with it: the head (`QuestHero`: the cover, what it is, the facts and beside them "Начать
 * квест", the progress or "Квест пройден"), then "Как пройти квест" until the walk is begun
 * (`QuestHowTo`: the mechanics in a paragraph and three steps), then the points — the current one with "Я на месте" during the walk —, their
 * timeline beside the map of the opened ones, which stays in sight. On phones the button is
 * also a bar at the bottom of the screen in place of the navigation: it is pressed on the street.
 */
export const QuestPage: NextPage<QuestPageProps> = ({ id, quest: initialQuest }) => {
    const { t, i18n } = useTranslation()
    const isAdmin = useAppSelector((state) => state.auth.user?.role === 'admin')
    const isAuth = useAppSelector((state) => state.auth.isAuth)

    // The server render's answer is in the hydrated cache: this subscribes to it and takes the
    // refetch after a confirmed point
    const { data: liveQuest } = API.useQuestsGetItemQuery({ id }, { skip: !id })
    const quest = liveQuest ?? initialQuest

    const { busy, confirm, leave, start } = useQuestConfirm(quest)

    if (!quest) {
        return <AppLayout />
    }

    const finished = !!quest.walk?.finished
    const confirmed = quest.walk?.confirmed ?? 0
    const started = !!quest.walk
    const atLimit = !started && !!quest.activeWalks && quest.activeWalks.count >= quest.activeWalks.max
    const pageUrl = `${SITE_LINK}${i18n.language === 'en' ? 'en/' : ''}${questHref(quest.id, quest.slug).replace(/^\//, '')}`
    const facts = [
        quest.location,
        t('game-quest-points', { count: quest.points }),
        formatLength(quest.length, i18n.language),
        `≈ ${formatWalkTime(walkMinutes(quest.length, quest.points), t)}`
    ].filter(Boolean)
    // What a link sent to a messenger shows: the quest's own words, or what it is and its facts
    const description =
        truncateText(quest.description?.replace(/\n/g, ' ') ?? undefined, 160) ||
        t('game-quest-seo-description', { facts: facts.join(', ') })
    // An absolute address for the messengers: the riddle quests' picture is the site's own file
    const cover = questCoverSrc(quest)
    const ogImage = cover?.startsWith('/') ? `${SITE_LINK}${cover.replace(/^\//, '')}` : cover

    const bar = !finished && (
        <div className={styles.bottomBar}>
            {started && (
                <span className={styles.barProgress}>
                    <strong>{confirmed}</strong> / {quest.points}
                </span>
            )}
            <Button
                mode={'primary'}
                size={'large'}
                icon={started ? 'Position' : undefined}
                stretched={true}
                loading={busy}
                disabled={busy || atLimit}
                label={
                    started ? t('game-here-button') : t(isAuth === false ? 'game-quest-sign-in' : 'game-quest-start')
                }
                className={styles.barButton}
                onClick={() => void (started ? confirm() : start())}
            />
        </div>
    )

    return (
        <AppLayout bottomBar={bar || undefined}>
            <Head>
                {generateNextSeo({
                    title: t('game-quest-seo-title', { title: quest.title }),
                    description,
                    canonical: pageUrl,
                    // A quest is a game: its page gives its points away to no crawler
                    noindex: true,
                    nofollow: false,
                    openGraph: {
                        description,
                        locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US',
                        siteName: t('geotags'),
                        images: ogImage ? [{ url: ogImage }] : undefined,
                        title: t('game-quest-seo-title', { title: quest.title }),
                        type: 'website',
                        url: pageUrl
                    },
                    twitter: { cardType: 'summary_large_image' }
                })}
            </Head>

            <div className={styles.page}>
                <QuestHero
                    quest={quest}
                    canEdit={isAdmin}
                    busy={busy}
                    onStart={() => void start()}
                    onLeave={() => void leave()}
                />

                {!started && (
                    <QuestHowTo
                        quest={quest}
                        isGuest={isAuth === false}
                    />
                )}

                <Section title={t('game-quest-steps-title')}>
                    <div className={styles.points}>
                        <div className={styles.pointsMap}>
                            <QuestMap
                                points={quest.items}
                                zone={quest.zone}
                            />
                        </div>

                        <div className={styles.pointsList}>
                            <QuestSteps
                                quest={quest}
                                busy={busy}
                                onConfirm={started && !finished ? (pointId) => void confirm(pointId) : undefined}
                            />
                        </div>
                    </div>
                </Section>
            </div>
        </AppLayout>
    )
}
