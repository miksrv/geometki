import React from 'react'
import { cn, Container, Icon, IconTypes } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { GameExploration } from '@/sections/game/game-exploration'
import { seasonHref } from '@/utils/game'
import { formatThousands } from '@/utils/helpers'

import styles from './styles.module.sass'

interface UserGameProps {
    userId: string
}

/**
 * The person in the game, in the side column of the profile overview. First what is theirs for
 * all time — "Исследовано": the share of the whole map as one big number, then their regions and
 * towns (visits pile up and are never reset). Under it their geopoints and place in the current
 * season. The medals of the seasons and the walked quests are awards: `UserAwardsShowcase`; the awards running now are `UserTasks`. Asked in the
 * browser (the profile page is cached without a viewer); nothing for one who has not played.
 */
export const UserGame: React.FC<UserGameProps> = ({ userId }) => {
    const { t } = useTranslation()
    const skip = !userId

    const { data } = API.useGameGetUserQuery(userId, { skip })
    const { data: exploration } = API.useGameGetExplorationQuery({ user: userId }, { skip })

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

            {rows.length > 0 && (
                <Container
                    title={t('user-side-game')}
                    action={
                        data.season ? (
                            <Link href={seasonHref(data.season.id, data.season.slug, data.season.current)}>
                                {data.season.title}
                            </Link>
                        ) : undefined
                    }
                >
                    <ul className={cn(styles.rows, styles.body)}>
                        {rows.map(({ key, icon, value }) => (
                            <li key={key}>
                                <Icon name={icon} />
                                <span className={styles.label}>{t(`user-side-game-${key}`)}</span>
                                <b>{value}</b>
                            </li>
                        ))}
                    </ul>
                </Container>
            )}
        </>
    )
}
