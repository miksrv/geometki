import React from 'react'
import { cn, Container, Icon, IconTypes, Tooltip } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { AchievementIcon } from '@/components/shared'
import { GameExploration } from '@/sections/game/game-exploration'
import { questHref, seasonHref, seasonTitle } from '@/utils/game'
import { formatThousands } from '@/utils/helpers'

import styles from './styles.module.sass'

/** Walked quests named on the profile; the count says how many there are */
const QUESTS_SHOWN = 5

interface UserGameProps {
    userId: string
}

/**
 * The person in the game, in the side column of the profile overview. First what is theirs for all time — "Исследовано": the share of the whole map as
 * one big number, then their regions and towns (visits pile up and are never reset). Under it
 * what a season is: their geopoints and place in the current one, and the seasons they took
 * part in as the seasons' pictures (each leads to its season, with their place there in the
 * hint). Then the quests they walked to the end (a walked quest leaves the quests' lists and
 * stays here). Asked in the browser (the profile page is cached without a viewer); nothing for
 * one who has not played.
 */
export const UserGame: React.FC<UserGameProps> = ({ userId }) => {
    const { t } = useTranslation()
    const skip = !userId

    const { data } = API.useGameGetUserQuery(userId, { skip })
    const { data: exploration } = API.useGameGetExplorationQuery({ user: userId }, { skip })
    const { data: walked } = API.useQuestsGetListQuery(
        { limit: QUESTS_SHOWN, user: userId, walk: 'done' },
        { skip: skip || !data?.walked }
    )

    if (!data) {
        return null
    }

    const rows = (
        [
            { icon: 'Award', key: 'points', value: data.points ? formatThousands(data.points) : undefined },
            { icon: 'BarChart', key: 'place', value: data.place ? `${data.place} / ${data.players}` : undefined }
        ] as Array<{ key: string; icon: IconTypes; value?: string }>
    ).filter((row) => !!row.value)

    return (
        <>
            {/* First what is for all time; the season under it starts anew every half a year */}
            <GameExploration exploration={exploration} />

            {(rows.length > 0 || data.seasons.length > 0) && (
                <Container
                    title={t('user-side-game')}
                    action={
                        <Link href={seasonHref(data.season.id, data.season.current)}>
                            {seasonTitle(t, data.season)}
                        </Link>
                    }
                >
                    {rows.length > 0 && (
                        <ul className={cn(styles.rows, styles.body)}>
                            {rows.map(({ key, icon, value }) => (
                                <li key={key}>
                                    <Icon name={icon} />
                                    <span className={styles.label}>{t(`user-side-game-${key}`)}</span>
                                    <b>{value}</b>
                                </li>
                            ))}
                        </ul>
                    )}

                    {data.seasons.length > 0 && (
                        <ul
                            className={styles.seasons}
                            aria-label={t('user-side-game-seasons')}
                        >
                            {data.seasons.map((season) => {
                                const title = seasonTitle(t, season)
                                const hint = season.place
                                    ? t('user-side-game-season-place', { place: season.place, title })
                                    : title

                                return (
                                    <li key={season.id}>
                                        <Tooltip content={hint}>
                                            <Link
                                                href={seasonHref(season.id, season.id === data.season.id)}
                                                aria-label={hint}
                                            >
                                                <AchievementIcon
                                                    image={season.image}
                                                    alt={''}
                                                    size={44}
                                                    category={'seasonal'}
                                                    group={`season-${season.id}`}
                                                />
                                            </Link>
                                        </Tooltip>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </Container>
            )}

            {!!walked?.items.length && (
                <Container
                    title={t('user-side-game-quests')}
                    action={<span className={styles.count}>{formatThousands(walked.count)}</span>}
                >
                    <ul className={cn(styles.rows, styles.body)}>
                        {walked.items.map((quest) => (
                            <li key={quest.id}>
                                <Icon name={'Compass'} />
                                <Link
                                    href={questHref(quest.id)}
                                    className={styles.link}
                                    title={quest.title}
                                >
                                    {quest.title}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </Container>
            )}
        </>
    )
}
