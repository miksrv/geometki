import React from 'react'
import { cn } from 'simple-react-ui-kit'

import type { NextPage } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'
import { generateNextSeo } from 'next-seo/pages'

import { ApiType } from '@/api'
import { AppLayout, GameLeaders, GamePoints, Section, UserAvatar } from '@/components/shared'
import { Breadcrumbs } from '@/components/ui'
import { SITE_LINK } from '@/config/env'
import { GAME_HREF, medalForPlace, seasonHref } from '@/utils/game'

import { GameAwards } from '../game-awards'
import { GameSeason } from '../game-season'
import { SeasonAdminActions } from '../season-admin-actions'
import { SeasonMedals } from '../season-medals'

import { SEASON_LEADERS_LIMIT } from './constants'

import styles from './styles.module.sass'

export interface SeasonPageProps {
    data: ApiType.Game.SeasonResponse
    leaders?: ApiType.Game.LeadersResponse | null
}

/**
 * The page of a past season — one that is over, with its frozen table once it is closed (the
 * current season is the game page): the season card as the head of the page (its name is the
 * h1), the podium of a closed season — its winners as cards —, the medals of the season (the
 * visitor's own is marked once the season is closed) and the whole rating, everywhere or by
 * location. A season announced but not begun has no rating yet. An administrator has
 * "Редактировать" on the line of the breadcrumbs.
 */
export const SeasonPage: NextPage<SeasonPageProps> = ({ data, leaders }) => {
    const { t, i18n } = useTranslation()

    const { season, winners } = data
    const title = season.title
    const pageUrl = `${SITE_LINK}${i18n.language === 'en' ? 'en/' : ''}${seasonHref(season.id, season.slug).replace(/^\//, '')}`
    const description = t('game-season-seo-description', { title })

    return (
        <AppLayout>
            <Head>
                {generateNextSeo({
                    title: t('game-season-seo-title', { title }),
                    description,
                    canonical: pageUrl,
                    noindex: false,
                    nofollow: false,
                    openGraph: {
                        description,
                        locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US',
                        siteName: t('geotags'),
                        title,
                        type: 'website',
                        url: pageUrl
                    }
                })}
            </Head>

            <div className={styles.page}>
                <div>
                    <SeasonAdminActions
                        seasonId={season.id}
                        className={styles.top}
                    >
                        <Breadcrumbs
                            className={styles.breadcrumbs}
                            links={[{ link: GAME_HREF, text: t('game-title') }]}
                        />
                    </SeasonAdminActions>
                    <GameSeason
                        season={season}
                        me={data.me}
                        totals={data.totals}
                    />
                </div>

                {season.closed && winners.length > 0 && (
                    <Section title={t('game-season-winners')}>
                        <ol className={styles.podium}>
                            {winners.map((winner) => (
                                <li
                                    key={winner.user.id}
                                    className={styles.winner}
                                >
                                    <span className={cn(styles.place, styles[`place-${winner.place}`])}>
                                        {winner.place}
                                    </span>
                                    <UserAvatar
                                        user={winner.user}
                                        size={'large'}
                                        disableLink={true}
                                        hideOnlineIcon={true}
                                    />
                                    <div className={styles.who}>
                                        <h3 className={styles.name}>
                                            <Link
                                                href={`/users/${winner.user.id}`}
                                                title={winner.user.name}
                                            >
                                                {winner.user.name}
                                            </Link>
                                        </h3>
                                        <span className={styles.facts}>
                                            {t('game-places-confirmed', { count: winner.places })}
                                        </span>
                                    </div>
                                    <GamePoints
                                        value={winner.points}
                                        label={t('game-points', { count: winner.points })}
                                    />
                                </li>
                            ))}
                        </ol>
                    </Section>
                )}

                <SeasonMedals
                    medals={season.medals}
                    mine={season.closed ? medalForPlace(data.me?.place) : null}
                />

                <GameAwards awards={data.awards} />

                {!season.upcoming && (
                    <Section title={t('game-leaders-title')}>
                        <GameLeaders
                            variant={'table'}
                            season={season.id}
                            initial={leaders ?? undefined}
                            limit={SEASON_LEADERS_LIMIT}
                        />
                    </Section>
                )}
            </div>
        </AppLayout>
    )
}
