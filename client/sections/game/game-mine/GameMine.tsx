import React, { useState } from 'react'
import { cn, Container } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiType } from '@/api'
import { GamePoints, PaginationBar, PlaceCard, Section } from '@/components/shared'
import { formatDate } from '@/utils/helpers'

import styles from './styles.module.sass'

/** Places on a page */
export const GAME_MINE_LIMIT = 10

interface GameMineProps {
    /** The server render's first page */
    initial?: ApiType.Game.MineResponse | null
}

/**
 * "Мой сезон": the visitor's own chronicle of the current season, in place of the hint where
 * to go once they have a counted place — every geotag counted for them, the latest first, as
 * the site's list of places (`PlaceCard variant="row"`): under a place when and how it was
 * confirmed (a check-in on the spot, a photo), on the right the geopoints it brought — the
 * blue pill of geopoints, as everywhere. Under the heading a paragraph of text — what the list
 * is and what the game is for; over the list what it adds up to; under it the page links — a
 * page is fetched on a tap, only this block is redrawn. Renders nothing without counted places.
 */
export const GameMine: React.FC<GameMineProps> = ({ initial }) => {
    const { t } = useTranslation()
    const [page, setPage] = useState<number>(1)

    // The server render's answer is the first page
    const skip = !!initial && page === 1
    const { data, isFetching } = API.useGameGetMineQuery(
        { limit: GAME_MINE_LIMIT, offset: (page - 1) * GAME_MINE_LIMIT || undefined },
        { skip }
    )

    // While the next page loads, the previous one stays (faded)
    const mine = skip ? initial : (data ?? initial)

    if (!mine?.items.length) {
        return null
    }

    return (
        <Section title={t('game-mine-title')}>
            {/* What the list is and what the game is for: a paragraph of text, like the memo under the head */}
            <p className={styles.intro}>{t('game-mine-intro')}</p>

            <Container>
                <p className={styles.summary}>
                    <span>{t('game-places-confirmed', { count: mine.count })}</span>
                    <span>{t('game-points', { count: mine.points })}</span>
                </p>

                <ol className={cn(styles.list, isFetching && styles.fetching)}>
                    {mine.items.map((item) => (
                        <li
                            key={item.id}
                            className={styles.item}
                        >
                            <PlaceCard
                                // A line of a chronicle: no excerpt of the description
                                place={{ ...item.place, content: undefined }}
                                variant={'row'}
                                size={'small'}
                                headingLevel={3}
                                footer={
                                    <span className={styles.facts}>
                                        <span>{formatDate(item.created.date, 'D MMMM')}</span>
                                        {item.way && <span>{t(`game-mine-way-${item.way}`)}</span>}
                                    </span>
                                }
                                actions={
                                    <GamePoints
                                        value={item.points}
                                        plus={true}
                                        label={t('game-points-plus', { count: item.points })}
                                    />
                                }
                            />
                        </li>
                    ))}
                </ol>
            </Container>

            <div className={styles.pages}>
                <PaginationBar
                    currentPage={page}
                    totalItemsCount={mine.count}
                    perPage={GAME_MINE_LIMIT}
                    disableScroll={true}
                    onChangePage={setPage}
                />
            </div>
        </Section>
    )
}
