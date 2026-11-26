import React, { useState } from 'react'
import { Button, cn } from 'simple-react-ui-kit'

import type { NextPage } from 'next'
import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { generateNextSeo } from 'next-seo/pages'

import { ApiType } from '@/api'
import { useAppSelector } from '@/app/store'
import { AppLayout, EmptyState, PageHeader, PaginationBar, QuestCard } from '@/components/shared'
import { Tabs } from '@/components/ui'
import { QUEST_CREATE_HREF, questHref, QUESTS_HREF } from '@/utils/game'

import { QUEST_MODES, QUESTS_PER_PAGE } from './constants'
import { QuestsMap } from './QuestsMap'

import styles from './styles.module.sass'

export interface QuestsPageProps {
    /** The page of the quests not being walked by the visitor (all of them for a guest), of `mode` */
    quests: ApiType.Game.Quest[]
    count: number
    currentPage: number
    /** The visitor's begun walks, of every mode: the shelf over the list on every page */
    active: ApiType.Game.Quest[]
    activeCount: number
    /** `?mode=`: one mode of the quests of the list */
    mode: ApiType.Game.QuestMode | null
}

type View = 'list' | 'map'

/** The anchor of the filter bar: switching a mode stays at the list instead of jumping to the top */
export const QUESTS_LIST_ANCHOR = 'quests-list'

const modeHref = (mode?: ApiType.Game.QuestMode | null): string =>
    `${mode ? `${QUESTS_HREF}?mode=${mode}` : QUESTS_HREF}#${QUESTS_LIST_ANCHOR}`

/**
 * The quests (`/quests`), a catalogue of outings in the manner of the trail catalogues:
 * `PageHeader` with the count and a lede that says what a quest is; the shelf of the visitor's
 * begun walks — "Вы проходите", low cards the width of the page (`QuestCard` `small`: the bar
 * of the walk and "Продолжить квест"), one under another, on every page and for every mode
 * (the filter is the list's); the modes as `Tabs` links (`?mode=`); the map of the page's
 * quests (`QuestsMap`: the pins of the quests' layer, a quest's card in a popup) as a low band
 * on the full width; then the tiles, three a row. Below 1024px `Tabs` "Список / Карта" swap
 * the map and the tiles. The nearest quests
 * come first (the visitor's location cookie), the walked ones last — green "Квест пройден".
 * A quest is no part of the game's seasons: walked once, whenever.
 */
export const QuestsPage: NextPage<QuestsPageProps> = ({ quests, count, currentPage, active, activeCount, mode }) => {
    const { t } = useTranslation()
    const isAdmin = useAppSelector((state) => state.auth.user?.role === 'admin')

    const [view, setView] = useState<View>('list')

    // A riddle quest has no start and is not on the maps
    const hasMap = quests.some((quest) => !!quest.start)

    return (
        <AppLayout>
            <Head>
                {generateNextSeo({
                    description: t('game-quests-description'),
                    nofollow: false,
                    noindex: true,
                    title: t('game-quests-seo-title')
                })}
            </Head>

            <PageHeader
                title={t('game-quests-title')}
                // A mode counts its own list; all the quests are the list and the shelf
                count={t('game-quests-count', { count: mode ? count : count + activeCount })}
                lede={currentPage === 1 ? t('game-quests-lede') : undefined}
                actions={
                    isAdmin && (
                        <Button
                            size={'medium'}
                            mode={'secondary'}
                            link={QUEST_CREATE_HREF}
                            label={t('create')}
                        />
                    )
                }
            />

            {active.length > 0 && (
                <section
                    className={styles.shelf}
                    aria-labelledby={'quests-active'}
                >
                    <h2
                        id={'quests-active'}
                        className={styles.shelfTitle}
                    >
                        {t('game-quests-active-title')}
                    </h2>

                    <div className={styles.shelfList}>
                        {active.map((quest) => (
                            <QuestCard
                                key={quest.id}
                                quest={quest}
                                size={'small'}
                                headingLevel={3}
                                action={
                                    <Button
                                        mode={'primary'}
                                        size={'medium'}
                                        link={questHref(quest.id, quest.slug)}
                                        label={t('home-quest-continue')}
                                    />
                                }
                            />
                        ))}
                    </div>
                </section>
            )}

            <div
                id={QUESTS_LIST_ANCHOR}
                className={styles.toolbar}
            >
                <Tabs<string>
                    className={styles.modes}
                    aria-label={t('game-quests-modes')}
                    activeTab={mode ?? 'all'}
                    tabs={[
                        { href: modeHref(), key: 'all', label: t('game-quests-mode-all') },
                        ...QUEST_MODES.map((key) => ({
                            href: modeHref(key),
                            key,
                            label: t(`game-quest-mode-${key}`)
                        }))
                    ]}
                />

                {hasMap && (
                    <Tabs<View>
                        className={styles.views}
                        aria-label={t('game-quests-view')}
                        activeTab={view}
                        onChangeTab={(key) => setView(key ?? 'list')}
                        tabs={[
                            { key: 'list', label: t('game-quests-view-list') },
                            { key: 'map', label: t('game-quests-view-map') }
                        ]}
                    />
                )}
            </div>

            {quests.length ? (
                <>
                    {hasMap && (
                        <div className={cn(styles.mapBand, view === 'map' && styles.mapShown)}>
                            <QuestsMap
                                // Remounted when shown on a narrow screen: Leaflet cannot size a hidden map
                                key={view}
                                quests={quests}
                            />
                        </div>
                    )}

                    <div className={cn(styles.grid, view === 'map' && styles.gridHidden)}>
                        {quests.map((quest, index) => (
                            <QuestCard
                                key={quest.id}
                                quest={quest}
                                priority={index < 3}
                            />
                        ))}
                    </div>

                    {view === 'list' && (
                        <PaginationBar
                            currentPage={currentPage}
                            totalItemsCount={count}
                            perPage={QUESTS_PER_PAGE}
                            linkPart={QUESTS_HREF.replace(/^\//, '')}
                            urlParam={mode ? { mode } : undefined}
                        />
                    )}
                </>
            ) : (
                <EmptyState
                    title={mode ? t('game-quests-empty-mode') : t('game-quests-empty')}
                    description={t('game-quests-slot-text')}
                />
            )}
        </AppLayout>
    )
}
