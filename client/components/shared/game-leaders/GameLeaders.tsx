import React, { useState } from 'react'
import { Button, cn, Container, Skeleton } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiType } from '@/api'
import { useAppSelector } from '@/app/store'
import { Chip, OptionList, Pagination, ScrollRail } from '@/components/ui'
import { leadersScopeKey } from '@/utils/game'

import { FilterPopout } from '../filter-panel'
import { GamePoints } from '../game-points'
import { LevelBadge } from '../level-badge/LevelBadge'
import { UserAvatar } from '../user-avatar'

import styles from './styles.module.sass'

type Scope = Pick<ApiType.Game.LeadersLocation, 'type' | 'id'>

/** A line of the rating; the visitor's own has no place until they have geopoints there */
type Line = Omit<ApiType.Game.Leader, 'place'> & { place: number | null }

export interface GameLeadersProps {
    /** The season (`2026-cold`); the current one without it */
    season?: string
    /** The rating of this location only, no scope chips (a location's page) */
    location?: Scope
    /** Lines shown at first, and added by "Показать ещё" */
    limit?: number
    /** "Показать ещё" loads the rest; a block shows only the top */
    expandable?: boolean
    /**
     * `table` — the rating as the main thing of a page (the game page, a past season): the
     * lines in a card with page links under them (a page is fetched on a tap, only this block
     * is redrawn) | a side column: the locations the season is played in as a dropdown, like
     * the sort of a listing — outside the card, over the lines on narrow screens —, then
     * `side`. `block` (default) — the lines with scope chips.
     */
    variant?: 'block' | 'table'
    /**
     * `table`: no page links — only the top (`limit` lines), and the visitor is always among
     * them: when they are below the top, or have no geopoints yet, their own line is the last one
     */
    topOnly?: boolean
    /** `table`: what stands in the side column under the location filter (the season's awards) */
    side?: React.ReactNode
    /** The first answer, from the server render: no skeleton, no request until the scope changes */
    initial?: ApiType.Game.LeadersResponse
    className?: string
}

/**
 * The rating of a season: who has the most geopoints, everywhere or in one location (the
 * locations the season is played in — "leaders of a region" are a tap away). A line is an
 * explorer: the place, the avatar and the name, the explored geotags, the geopoints. The
 * visitor's own line is highlighted; when it is not among the lines shown (another page) the
 * same line stands under them, set apart by a dashed rule; in the top of the game page
 * (`topOnly`) it takes the last line instead, a dash for the place while they have no
 * geopoints — wherever they are in the table, the visitor sees themselves.
 */
export const GameLeaders: React.FC<GameLeadersProps> = ({
    season,
    location,
    limit = 10,
    expandable,
    variant = 'block',
    topOnly,
    side,
    initial,
    className
}) => {
    const { t } = useTranslation()
    const viewer = useAppSelector((state) => state.auth.user)
    const userId = viewer?.id

    const [scope, setScope] = useState<Scope | undefined>(location)
    const [shown, setShown] = useState<number>(limit)
    // `table`: the page of the rating, from 1
    const [page, setPage] = useState<number>(1)

    const isTable = variant === 'table'

    // The server render's answer serves until the visitor asks for another scope, page or more lines
    const skip = !!initial && leadersScopeKey(scope) === leadersScopeKey(location) && shown === limit && page === 1

    const { data, isFetching } = API.useGameGetLeadersQuery(
        isTable
            ? { id: scope?.id, limit, offset: (page - 1) * limit || undefined, season, type: scope?.type }
            : { id: scope?.id, limit: shown, season, type: scope?.type },
        { skip }
    )

    // While the next scope loads, the previous lines stay (faded)
    const leaders = skip ? initial : (data ?? initial)
    const locations = (leaders ?? initial)?.locations ?? []
    const me = leaders?.me
    // Not among the lines shown (another page, below the top): their own line goes under the
    // list all the same — wherever they stand, the visitor sees themselves
    const outside = !!viewer && !!leaders && !leaders.items.some(({ user }) => user.id === userId)
    const meApart: Line | undefined =
        !topOnly && outside && me?.place
            ? { place: me.place, places: me.places, points: me.points, quests: me.quests, user: viewer }
            : undefined

    // The top only: the visitor is always in it — below the top, or without geopoints, their
    // line takes the last place of the list
    const leaderLines: Line[] =
        topOnly && outside && leaders.items.length
            ? [
                  ...leaders.items.slice(0, Math.max(limit - 1, 0)),
                  {
                      place: me?.place ?? null,
                      places: me?.places ?? 0,
                      points: me?.points ?? 0,
                      quests: me?.quests ?? 0,
                      user: viewer
                  }
              ]
            : (leaders?.items ?? [])

    const changeScope = (next?: Scope) => {
        setScope(next)
        setShown(limit)
        setPage(1)
    }

    const row = (leader: Line, own: boolean) => (
        <li
            key={leader.user.id}
            className={cn(styles.row, own && styles.own)}
        >
            <span className={cn(styles.place, !!leader.place && leader.place <= 3 && styles.top)}>
                {leader.place ?? '—'}
            </span>

            <UserAvatar
                user={leader.user}
                size={'medium'}
                hideOnlineIcon={true}
            />

            <span className={styles.who}>
                <Link
                    href={`/users/${leader.user.id}`}
                    className={styles.name}
                    title={leader.user.name}
                >
                    {leader.user.name}
                </Link>
                <span className={styles.facts}>{t('game-places-confirmed', { count: leader.places })}</span>
            </span>

            {!!leader.user.levelData?.level && (
                <LevelBadge
                    level={leader.user.levelData.level}
                    size={22}
                />
            )}

            <GamePoints
                value={leader.points}
                size={'small'}
                label={t('game-points', { count: leader.points })}
                className={styles.points}
            />
        </li>
    )

    const chips = !location && locations.length > 0 && (
        <ScrollRail
            variant={'chips'}
            className={styles.scopes}
        >
            <Chip
                size={'small'}
                label={t('game-leaders-everywhere')}
                selected={!scope}
                onClick={() => changeScope(undefined)}
            />
            {locations.map((item) => (
                <Chip
                    key={leadersScopeKey(item)}
                    size={'small'}
                    label={item.title}
                    count={item.players}
                    selected={leadersScopeKey(scope) === leadersScopeKey(item)}
                    onClick={() => changeScope({ id: item.id, type: item.type })}
                />
            ))}
        </ScrollRail>
    )

    const lines = !leaders ? (
        <ul
            className={styles.list}
            aria-hidden={true}
        >
            {Array.from({ length: 3 }, (_, index) => (
                <li
                    key={index}
                    className={styles.row}
                >
                    <Skeleton style={{ height: 18, width: 18 }} />
                    <Skeleton style={{ borderRadius: '50%', height: 36, width: 36 }} />
                    <span className={styles.who}>
                        <Skeleton style={{ height: 14, marginBottom: 6, width: '55%' }} />
                        <Skeleton style={{ height: 12, width: '35%' }} />
                    </span>
                    <Skeleton style={{ height: 16, width: 44 }} />
                </li>
            ))}
        </ul>
    ) : leaders.items.length ? (
        <>
            <ol
                className={cn(styles.list, isFetching && styles.fetching)}
                aria-label={t('game-leaders-title')}
                // A page starts where the previous one stopped
                start={leaders.items[0]?.place}
            >
                {leaderLines.map((leader) => row(leader, leader.user.id === userId))}
            </ol>

            {meApart && (
                <ul
                    className={styles.apart}
                    aria-label={t('game-leaders-me')}
                >
                    {row(meApart, true)}
                </ul>
            )}

            {!isTable && expandable && leaders.count > leaders.items.length && (
                <Button
                    mode={'secondary'}
                    size={'medium'}
                    stretched={true}
                    loading={isFetching}
                    disabled={isFetching}
                    label={t('game-leaders-more', {
                        count: Math.min(limit, leaders.count - leaders.items.length)
                    })}
                    onClick={() => setShown((value) => value + limit)}
                />
            )}

            {isTable && !topOnly && leaders.count > limit && (
                <div className={styles.pages}>
                    <span className={styles.range}>
                        {t('pagination-range', '{{from}}–{{to}} of {{total}}', {
                            from: (page - 1) * limit + 1,
                            to: Math.min(page * limit, leaders.count),
                            total: leaders.count
                        })}
                    </span>
                    <Pagination
                        currentPage={page}
                        totalItemsCount={leaders.count}
                        perPage={limit}
                        disableScroll={true}
                        captionPage={t('page')}
                        captionNextPage={t('next-page')}
                        captionPrevPage={t('prev-page')}
                        onChangePage={setPage}
                    />
                </div>
            )}
        </>
    ) : (
        <p className={styles.empty}>{scope ? t('game-leaders-empty-location') : t('game-leaders-empty')}</p>
    )

    if (!isTable) {
        return (
            <div className={cn(styles.leaders, className)}>
                {chips}
                {lines}
            </div>
        )
    }

    const groups: Array<{ key: string; items: ApiType.Game.LeadersLocation[] }> = [
        { items: locations.filter(({ type }) => type === 'region'), key: 'regions' },
        { items: locations.filter(({ type }) => type !== 'region'), key: 'localities' }
    ].filter(({ items }) => items.length)

    const scopeKey = leadersScopeKey(scope)

    const hasFilter = !location && groups.length > 0

    return (
        <div className={cn(styles.table, !hasFilter && !side && styles.tableAlone, className)}>
            <Container className={styles.tableMain}>
                <div className={styles.leaders}>{lines}</div>
            </Container>

            {/* The side column sticks while the lines scroll. On narrow screens it is no box of
                its own: the filter goes over the lines, the rest under them */}
            {(hasFilter || side) && (
                <aside className={styles.tableAside}>
                    {/* The location of the rating: a filter, outside the card like every filter — the
                    first thing of the side column, over the lines on narrow screens */}
                    {hasFilter && (
                        <div className={styles.tableFilter}>
                            <FilterPopout
                                className={styles.scopeField}
                                icon={'Point'}
                                width={360}
                                active={!!scope}
                                value={
                                    locations.find((item) => leadersScopeKey(item) === scopeKey)?.title ??
                                    t('game-leaders-everywhere')
                                }
                            >
                                {(close) => (
                                    <OptionList
                                        groups={[
                                            {
                                                items: [
                                                    {
                                                        key: 'all',
                                                        label: t('game-leaders-everywhere'),
                                                        selected: !scope
                                                    }
                                                ]
                                            },
                                            ...groups.map(({ key, items }) => ({
                                                items: items.map((item) => ({
                                                    caption: t('game-season-players', { count: item.players }),
                                                    key: leadersScopeKey(item),
                                                    label: item.title,
                                                    selected: leadersScopeKey(item) === scopeKey
                                                })),
                                                label: t(`game-exploration-${key}`)
                                            }))
                                        ]}
                                        onSelect={(key) => {
                                            const next = locations.find((item) => leadersScopeKey(item) === key)

                                            close()
                                            changeScope(next ? { id: next.id, type: next.type } : undefined)
                                        }}
                                    />
                                )}
                            </FilterPopout>
                        </div>
                    )}

                    {side && <div className={styles.tableSide}>{side}</div>}
                </aside>
            )}
        </div>
    )
}
