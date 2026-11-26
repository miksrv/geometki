import React from 'react'
import { Button } from 'simple-react-ui-kit'

import type { NextPage } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'
import { generateNextSeo } from 'next-seo/pages'

import { ApiType } from '@/api'
import { AppLayout, GameLeaders, QuestsPromo, Section } from '@/components/shared'
import { SITE_LINK } from '@/config/env'
import { GAME_HELP_HREF, SEASON_RATING_HREF, VISITS_FEED_HREF } from '@/utils/game'
import { buildHreflangTags } from '@/utils/seo'

import { GameAwards } from '../game-awards'
import { GameMine } from '../game-mine'
import { GameNoSeason } from '../game-no-season'
import { GamePastSeasons } from '../game-past-seasons'
import { GamePlaces } from '../game-places'
import { GameSeason } from '../game-season'
import { SeasonAdminActions } from '../season-admin-actions'
import { SeasonMedals } from '../season-medals'

import { GAME_LEADERS_LIMIT } from './constants'

import styles from './styles.module.sass'

export interface GamePageProps {
    /** `season` is the current one, the nearest upcoming one, or null between seasons */
    game: ApiType.Game.GetResponse
    leaders?: ApiType.Game.LeadersResponse | null
    /** A player's own season: the places counted for them */
    mine?: ApiType.Game.MineResponse | null
    /** Where to go, for someone without a counted place this season */
    places?: ApiType.Game.PlacesResponse | null
    /** The places are the nearest to the visitor's point (their location cookie) */
    placesNearby?: boolean
    /** The quests the visitor has not walked: the page only invites to their section */
    questsCount?: number
    /** The cover of the nearest of them: the picture of the invitation */
    questsCover?: string | null
}

/**
 * The section "Game" (DESIGN.md → The game) is the current season, and its only page, block
 * under block on the full width — the season, the visitor in it, the others:
 *
 * 1. the season card as the head (the season's name is the h1; under the bar of time the plain
 *    links "Все участники сезона · События · Как играть" — the events are the feed's
 *    check-ins —); above it an administrator has "Создать" and "Редактировать"
 *    (seasons are made on the site, like quests);
 * 2. the memo, one paragraph of text on the page: what the game is for a guest and someone
 *    who has not played, a reminder of the rules for a player, with the way to "Как играть";
 * 3. "Топ участников сезона" — the top ten explorers, the visitor always among them (the last
 *    line when they are below the top or have no geopoints) | the side column: the locations
 *    as a dropdown filter (over the lines on narrow screens), then the season's limited
 *    awards, when there are any, and the last two past seasons (the only ones with a page of
 *    their own) — the column sticks while the lines scroll; "Весь рейтинг"
 *    is the explorers' list in the season's order;
 * 4. the visitor's own: "Мой сезон" — the places counted for them, a chronicle with page links
 *    — once they have one; until then (and for a guest) "Какие места посетить", four places
 *    worth going to;
 * 5. `QuestsPromo` — an invitation to the quests, a section of their own, no part of a season.
 *
 * On narrow screens every pair of columns is one column in that order.
 *
 * Seasons are made by hand, so the page has two other looks: an announced season that has not
 * begun (the card says when it starts, no rating, no places — the medals, the awards and the
 * last season stay), and no season at all (a calm word in place of the card). Both keep the
 * memo, the past season and the invitation to the quests.
 */
export const GamePage: NextPage<GamePageProps> = ({
    game,
    leaders,
    mine,
    places,
    placesNearby,
    questsCount,
    questsCover
}) => {
    const { t, i18n } = useTranslation()

    const canonicalUrl = `${SITE_LINK}${i18n.language === 'en' ? 'en/' : ''}game`
    const description = t('game-lede')
    const { season } = game
    const seoTitle = season ? t('game-seo-title', { season: season.title }) : t('game-seo-title-between')

    // A player has their own season; everyone else is told where to go
    const playing = !!mine?.items.length

    return (
        <AppLayout>
            <Head>
                {generateNextSeo({
                    title: seoTitle,
                    description,
                    canonical: canonicalUrl,
                    noindex: false,
                    nofollow: false,
                    openGraph: {
                        description,
                        locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US',
                        siteName: t('geotags'),
                        title: seoTitle,
                        type: 'website',
                        url: canonicalUrl
                    },
                    twitter: { cardType: 'summary_large_image' },
                    additionalLinkTags: buildHreflangTags('game')
                })}
            </Head>

            <div className={styles.page}>
                <div className={styles.head}>
                    <SeasonAdminActions
                        seasonId={season?.id}
                        create={true}
                    />

                    {season ? (
                        <GameSeason
                            season={season}
                            me={game.me}
                            totals={game.totals}
                            links={[
                                { href: SEASON_RATING_HREF, label: t('game-season-all-players') },
                                { href: VISITS_FEED_HREF, label: t('game-season-events') },
                                { href: GAME_HELP_HREF, label: t('game-rules-title') }
                            ]}
                        />
                    ) : (
                        <GameNoSeason />
                    )}
                </div>

                {/* The memo under the head: what the game is for someone who has not played, a
                    reminder of the rules for a player */}
                <p className={styles.intro}>
                    {playing && season?.current ? t('game-intro-player') : t('game-intro')} {t('game-intro-more')}{' '}
                    <Link href={GAME_HELP_HREF}>{t('game-intro-more-link')}</Link>.
                </p>

                {season?.current && (
                    <>
                        <Section
                            title={t('game-leaders-top')}
                            action={
                                <Button
                                    mode={'link'}
                                    link={SEASON_RATING_HREF}
                                    label={t('game-leaders-all')}
                                />
                            }
                        >
                            <GameLeaders
                                variant={'table'}
                                topOnly={true}
                                initial={leaders ?? undefined}
                                limit={GAME_LEADERS_LIMIT}
                                side={
                                    game.awards.length > 0 || game.seasons.length > 0 ? (
                                        <>
                                            <GameAwards awards={game.awards} />
                                            <GamePastSeasons seasons={game.seasons} />
                                        </>
                                    ) : undefined
                                }
                            />
                        </Section>

                        {playing ? (
                            <GameMine initial={mine} />
                        ) : (
                            <GamePlaces
                                initial={places}
                                initialNearby={placesNearby}
                            />
                        )}
                    </>
                )}

                {season && <SeasonMedals medals={season.medals} />}

                {/* No rating beside them: the awards and the last season stand on their own */}
                {!season?.current && (game.awards.length > 0 || game.seasons.length > 0) && (
                    <div className={styles.aside}>
                        <GameAwards awards={game.awards} />
                        <GamePastSeasons seasons={game.seasons} />
                    </div>
                )}

                <QuestsPromo
                    count={questsCount}
                    cover={questsCover ?? undefined}
                />
            </div>
        </AppLayout>
    )
}
