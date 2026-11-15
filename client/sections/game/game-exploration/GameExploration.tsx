import React from 'react'
import { cn, Container } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'
import { buildLocationHref, getLandingFlags } from '@/utils/helpers'

import styles from './styles.module.sass'

/** Below this many places a share says nothing: "2 из 2" instead of a percentage */
const PERCENT_MIN_PLACES = 5

const REGIONS_SHOWN = 4
const LOCALITIES_SHOWN = 3

interface GameExplorationProps {
    exploration?: ApiType.Game.ExplorationResponse | null
    /** The block's title: "Исследовано" by default */
    title?: string
    className?: string
}

/**
 * How much a person has explored, for all time — what the seasons do not reset. First the
 * share of the whole map as one big number with a bar ("3% мира"), then their regions and
 * towns: a row per location with a bar, the name a link to its places. Exploring is being
 * there (a visit, confirmed or not); the share falls when new places are added. Renders
 * nothing for a person who has been nowhere yet.
 */
export const GameExploration: React.FC<GameExplorationProps> = ({ exploration, title, className }) => {
    const { t } = useTranslation()
    const flags = getLandingFlags()

    const groups = [
        { items: exploration?.regions.slice(0, REGIONS_SHOWN) ?? [], key: 'regions' },
        { items: exploration?.localities.slice(0, LOCALITIES_SHOWN) ?? [], key: 'localities' }
    ].filter(({ items }) => items.length)

    const world = exploration?.world
    const worldPercent = world?.total ? (world.explored / world.total) * 100 : 0

    if (!groups.length && !world?.explored) {
        return null
    }

    const content = (
        <div className={styles.groups}>
            {!!world?.explored && (
                <div className={styles.world}>
                    <div className={styles.worldHead}>
                        <span className={styles.worldValue}>
                            {/* A tenth of a percent while the share is small: one place must show */}
                            {worldPercent < 10 ? worldPercent.toFixed(1).replace(/\.0$/, '') : Math.round(worldPercent)}
                            %
                        </span>
                        <span className={styles.worldLabel}>{t('game-exploration-world')}</span>
                    </div>
                    <div
                        className={cn(styles.bar, styles.worldBar)}
                        role={'progressbar'}
                        aria-label={t('game-exploration-world')}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(worldPercent)}
                    >
                        <div
                            className={styles.fill}
                            style={{ width: `${Math.max(worldPercent, 2)}%` }}
                        />
                    </div>
                    <span className={styles.caption}>
                        {t('game-exploration-places', { count: world.total, explored: world.explored })}
                    </span>
                </div>
            )}

            {groups.map(({ key, items }) => (
                <div key={key}>
                    <h4 className={styles.label}>{t(`game-exploration-${key}`)}</h4>
                    <ul className={styles.list}>
                        {items.map((item) => {
                            const percent = Math.round((item.explored / item.total) * 100)
                            const value =
                                item.total < PERCENT_MIN_PLACES
                                    ? t('game-exploration-of', { explored: item.explored, total: item.total })
                                    : `${percent}%`

                            return (
                                <li
                                    key={`${item.type}-${item.id}`}
                                    className={styles.row}
                                >
                                    <div className={styles.rowHead}>
                                        <Link
                                            href={buildLocationHref(item, flags)}
                                            className={styles.name}
                                            title={item.title}
                                        >
                                            {item.title}
                                        </Link>
                                        <span
                                            className={styles.value}
                                            title={t('game-exploration-hint', {
                                                explored: item.explored,
                                                total: item.total
                                            })}
                                        >
                                            {value}
                                        </span>
                                    </div>
                                    <div
                                        className={styles.bar}
                                        role={'progressbar'}
                                        aria-label={item.title}
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        aria-valuenow={percent}
                                    >
                                        <div
                                            className={styles.fill}
                                            // A place visited shows even in a big region
                                            style={{ width: `${Math.max(percent, 2)}%` }}
                                        />
                                    </div>
                                    {item.total >= PERCENT_MIN_PLACES && (
                                        <span className={styles.caption}>
                                            {t('game-exploration-places', {
                                                count: item.total,
                                                explored: item.explored
                                            })}
                                        </span>
                                    )}
                                </li>
                            )
                        })}
                    </ul>
                </div>
            ))}
        </div>
    )

    return (
        <Container
            title={title ?? t('game-exploration-title')}
            className={className}
        >
            {content}
        </Container>
    )
}
