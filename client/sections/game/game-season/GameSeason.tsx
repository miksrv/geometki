import React from 'react'
import { Button, cn } from 'simple-react-ui-kit'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'
import { openAuthDialog } from '@/app/applicationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { AchievementIcon, GamePoints, UserAvatar } from '@/components/shared'
import { StatTiles } from '@/components/ui'
import { IMG_HOST } from '@/config/env'
import { formatPlainDate } from '@/utils/date'
import { GAME_HREF, seasonTitle } from '@/utils/game'
import { dateToUnixTime, formatThousands, numberFormatter } from '@/utils/helpers'
import { buildPlaceUrl } from '@/utils/place'

import { SeasonImageUpload } from './SeasonImageUpload'

import styles from './styles.module.sass'

interface GameSeasonProps {
    season: ApiType.Game.Season
    /** The visitor's own line; a guest has none */
    me?: ApiType.Game.Standing
    totals: { players: number; places: number; quests?: number }
    /**
     * `page` (default) — the head of the game page and of a past season's page: the season's
     * name is the h1, the profile card's size, the dates; the card ends there — the rating and
     * the places are the page's own blocks. An administrator replaces the picture by a tap on
     * it. `home` — the same card on the signed-in home page: smaller, the name a section title
     * that leads to the game, no dates, the head no taller than the picture, and under it the
     * visitor in the table and the next place
     */
    variant?: 'page' | 'home'
    /** `home`: the next step — the most valuable place the visitor has not explored this season */
    next?: ApiType.Game.ValuablePlace
    className?: string
    /** The last line under the bar of time, plain links through a dot: "Рейтинги сезона · Как играть" */
    links?: Array<{ href: string; label: string }>
    /** Under the facts, on the line of "Войти и играть" */
    children?: React.ReactNode
}

/** A line of the table next to the visitor; their own has no place until they have geopoints */
type RivalLine = Omit<ApiType.Game.Leader, 'place'> & { place: number | null }

/** Days left from which the line turns into a warning: the season is about to end */
const LAST_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000

/** The share of the season that has passed, 0–100: its dates are plain calendar days */
const seasonPassed = (season: ApiType.Game.Season): number => {
    const days = Math.round((Date.parse(season.to) - Date.parse(season.from)) / DAY_MS) + 1

    if (!Number.isFinite(days) || days <= 0) {
        return 0
    }

    return Math.max(0, Math.min(100, ((days - season.daysLeft) / days) * 100))
}

/**
 * The season card, one component wherever a season is shown (as `UserProfileCard` is for a
 * person): the head of the game page (the current season) and of a past season's page, and —
 * `variant="home"`, simpler — the game on the signed-in home page
 * (DESIGN.md → The game → GameSeason).
 *
 * Above: the season's picture | its name, the dates, how much of it has passed (a thin bar of
 * time, not a goal) | the counters, the profile card's tiles (`StatTiles`): the visitor's place
 * (a dash until they have geopoints) and how many play.
 *
 * Below, on the home page while the season goes on: the visitor in the table — their own line
 * next to the player above; someone who has not played stands under the last player | the
 * next step — one place worth going to, with the geopoints a check-in there gives now.
 */
export const GameSeason: React.FC<GameSeasonProps> = ({
    season,
    me,
    totals,
    variant = 'page',
    next,
    className,
    links,
    children
}) => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()
    const isAuth = useAppSelector((state) => state.auth.isAuth)
    const viewer = useAppSelector((state) => state.auth.user)
    const isAdmin = viewer?.role === 'admin'

    const isHome = variant === 'home'
    const Heading = isHome ? 'h2' : 'h1'
    const playing = !!me && me.place != null
    const sameYear = season.from.slice(0, 4) === season.to.slice(0, 4)
    const dates = `${formatPlainDate(season.from, sameYear ? 'D MMMM' : 'D MMMM YYYY')} — ${formatPlainDate(season.to, 'D MMMM YYYY')}`

    // The counters of the card, the profile card's tiles: where the visitor stands (a dash
    // until they have geopoints) and how many play
    const players = me?.players ?? totals.players
    const stats: React.ComponentProps<typeof StatTiles>['items'] = [
        ...(me
            ? [{ key: 'place', label: t('game-season-counter-place'), value: playing ? String(me.place) : '—' }]
            : []),
        {
            key: 'players',
            label: t('game-season-counter-players', { count: players }),
            value: formatThousands(players)
        }
    ]

    const above = me?.rivals?.above
    const below = me?.rivals?.below
    const place = me?.place ?? 0

    // The visitor in the table (the home page): their own line next to the player above — the
    // one below instead for the first one. Someone without geopoints stands under the last
    // player. Alone in the table — their avatar, name and geopoints
    const own: RivalLine | undefined =
        me && viewer
            ? { place: me.place, places: me.places, points: me.points, quests: me.quests, user: viewer }
            : undefined
    const lines: RivalLine[] = !own ? [] : above ? [above, own] : below ? [own, below] : []

    // A check-in at the next place is enough to go up a place, or to get into the rating
    const nextNote = !next
        ? undefined
        : me && !playing
          ? t('game-season-next-first')
          : playing && me.ahead != null && next.game.points > me.ahead
            ? t('game-season-next-enough', { place: place - 1 })
            : undefined

    const rivalRow = (leader: RivalLine, own?: boolean) => (
        <li
            key={leader.user.id}
            className={cn(styles.rival, own && styles.own)}
        >
            <span className={styles.rivalPlace}>{leader.place ?? '—'}</span>
            <UserAvatar
                user={leader.user}
                size={'small'}
                hideOnlineIcon={true}
                disableLink={own}
            />
            {own ? (
                <span className={styles.rivalName}>{leader.user.name}</span>
            ) : (
                <Link
                    href={`/users/${leader.user.id}`}
                    className={styles.rivalName}
                    title={leader.user.name}
                >
                    {leader.user.name}
                </Link>
            )}
            <GamePoints
                value={leader.points}
                size={'small'}
                label={t('game-points', { count: leader.points })}
            />
        </li>
    )

    const badge = (
        <AchievementIcon
            image={season.image}
            alt={''}
            size={isHome ? 96 : 112}
            category={'seasonal'}
            group={`season-${season.id}`}
        />
    )

    const showMe = !!me && !!viewer
    // What to do next is the home page's: the game page has the rating and the places under the card
    const showNow = isHome && season.current && !season.closed && (showMe || !!next)

    return (
        <section
            className={cn(styles.card, isHome ? styles.block : styles.head, styles[season.key], className)}
            aria-label={isHome ? t('game-title') : undefined}
        >
            <div className={styles.top}>
                <div className={styles.badge}>
                    {/* An administrator replaces the picture by a tap on it, on the season's page */}
                    {isAdmin && !isHome ? <SeasonImageUpload seasonId={season.id}>{badge}</SeasonImageUpload> : badge}
                </div>

                <div className={styles.main}>
                    <span className={styles.overline}>
                        {season.closed
                            ? t('game-season-closed')
                            : season.current
                              ? t('game-season-current')
                              : t('game-season-over')}
                    </span>
                    <Heading className={styles.title}>
                        {isHome ? <Link href={GAME_HREF}>{seasonTitle(t, season)}</Link> : seasonTitle(t, season)}
                    </Heading>

                    {!isHome && <p className={styles.dates}>{dates}</p>}

                    {/* How much of the season has passed: time, not a goal — the words say it */}
                    {season.current && (
                        <div className={cn(styles.time, season.daysLeft <= LAST_DAYS && styles.lastDays)}>
                            <span
                                className={styles.timeBar}
                                aria-hidden={true}
                            >
                                <span style={{ width: `${seasonPassed(season)}%` }} />
                            </span>
                            <span className={styles.timeLeft}>
                                {t('game-season-days-left', { count: season.daysLeft })}
                            </span>
                        </div>
                    )}

                    {!!links?.length && (
                        <p className={styles.links}>
                            {links.map(({ href, label }) => (
                                <Link
                                    key={href}
                                    href={href}
                                >
                                    {label}
                                </Link>
                            ))}
                        </p>
                    )}

                    {((isAuth === false && !season.closed) || children) && (
                        <div className={styles.actions}>
                            {isAuth === false && !season.closed && (
                                <Button
                                    mode={'primary'}
                                    size={'medium'}
                                    label={t('game-season-sign-in')}
                                    onClick={() => dispatch(openAuthDialog())}
                                />
                            )}

                            {children}
                        </div>
                    )}
                </div>

                <StatTiles
                    className={styles.stats}
                    aria-label={t('game-season-counters')}
                    items={stats}
                />
            </div>

            {showNow && (
                <div className={cn(styles.now, showMe && !!next && styles.nowBoth)}>
                    {showMe && (
                        <div className={styles.chase}>
                            {lines.length ? (
                                <ol
                                    className={styles.rivals}
                                    start={lines[0].place ?? undefined}
                                    aria-label={t('game-season-rivals')}
                                >
                                    {lines.map((line) => rivalRow(line, line === own))}
                                </ol>
                            ) : (
                                <div className={styles.chaseLine}>
                                    <UserAvatar
                                        user={viewer}
                                        size={'medium'}
                                        hideOnlineIcon={true}
                                    />
                                    <span className={styles.chaseText}>
                                        <Link
                                            href={`/users/${viewer.id}`}
                                            className={styles.chaseName}
                                            title={viewer.name}
                                        >
                                            {viewer.name}
                                        </Link>
                                        {playing ? (
                                            <GamePoints
                                                value={me.points}
                                                size={'small'}
                                                label={t('game-points', { count: me.points })}
                                                className={styles.chasePoints}
                                            />
                                        ) : (
                                            <span className={styles.chaseWho}>{t('game-season-invite')}</span>
                                        )}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {next && (
                        <Link
                            href={buildPlaceUrl(next.id, next.slug)}
                            className={styles.next}
                        >
                            <span className={styles.nextCover}>
                                {next.cover?.preview && (
                                    <Image
                                        src={`${IMG_HOST}${next.cover.preview}?d=${dateToUnixTime(next.updated?.date)}`}
                                        alt={''}
                                        fill
                                        sizes={'96px'}
                                        style={{ objectFit: 'cover' }}
                                    />
                                )}
                            </span>
                            <span className={styles.nextMain}>
                                <span className={styles.overline}>{t('game-season-next')}</span>
                                <span className={styles.nextTitle}>{next.title}</span>
                                <span className={styles.nextFacts}>
                                    {!!next.distance && <span>{`${numberFormatter(next.distance)} ${t('km')}`}</span>}
                                    {nextNote && <span>{nextNote}</span>}
                                </span>
                            </span>
                            <GamePoints
                                value={next.game.points}
                                plus={true}
                                label={t('game-points-for-visit', { count: next.game.points })}
                            />
                        </Link>
                    )}
                </div>
            )}
        </section>
    )
}
