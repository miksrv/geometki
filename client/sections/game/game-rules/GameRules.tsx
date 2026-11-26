import React, { useState } from 'react'
import { cn, Container, Icon } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'
import { CategoryIcon, GamePoints, GamePointsIcon } from '@/components/shared'
import { categoriesByFactor, formatLength } from '@/utils/game'

import styles from './styles.module.sass'

interface GamePointsTableProps {
    rules: ApiType.Game.Rules
}

/** "×1,5" / "×1.5" */
const factorText = (factor: number, locale: string): string =>
    `×${String(factor).replace('.', locale === 'ru' ? ',' : '.')}`

/**
 * The public table of points: every number of the formula as the server counts it
 * (`GET /game` → `rules`) — the base, the categories of each factor as their icons, the bonus
 * to the first ones, the photo, the white spot, the quest. Folded behind its heading: a
 * reference for those who want the exact numbers, under the plain words of "How to play".
 */
export const GamePointsTable: React.FC<GamePointsTableProps> = ({ rules }) => {
    const { t, i18n } = useTranslation()
    const [open, setOpen] = useState<boolean>(false)

    const groups = categoriesByFactor(rules)
    const radiuses = Object.values(rules.radiuses)
    const first = rules.order[0]
    const next = rules.order[1]

    return (
        <Container className={styles.table}>
            {/* The heading is the disclosure control: the numbers are a tap away, not a wall of them */}
            <h3 className={styles.tableHeading}>
                <button
                    type={'button'}
                    className={cn(styles.toggle, open && styles.open)}
                    aria-expanded={open}
                    aria-controls={'game-points-table'}
                    onClick={() => setOpen((prev) => !prev)}
                >
                    <GamePointsIcon className={styles.toggleIcon} />
                    {t('game-rules-table-title')}
                    <small>{t('game-rules-table-hint')}</small>
                    <Icon
                        name={'KeyboardDown'}
                        className={styles.chevron}
                    />
                </button>
            </h3>

            <div
                id={'game-points-table'}
                hidden={!open}
            >
                <p className={styles.formula}>{t('game-rules-formula')}</p>

                <dl className={styles.rows}>
                    <div className={styles.row}>
                        <dt>
                            <strong>{t('game-rules-base')}</strong>
                            <span>{t('game-rules-base-note')}</span>
                        </dt>
                        <dd>
                            <GamePoints
                                value={rules.base}
                                variant={'plain'}
                            />
                        </dd>
                    </div>

                    {groups.map(({ factor, categories }) => (
                        <div
                            key={factor}
                            className={styles.row}
                        >
                            <dt>
                                <strong>
                                    {t(`game-rules-category-${factor >= 2 ? 'far' : factor > 1 ? 'out' : 'town'}`)}
                                </strong>
                                <span className={styles.categories}>
                                    {categories.map((category) => (
                                        <CategoryIcon
                                            key={category}
                                            category={category}
                                            size={20}
                                        />
                                    ))}
                                </span>
                            </dt>
                            <dd className={styles.factor}>{factorText(factor, i18n.language)}</dd>
                        </div>
                    ))}

                    {first && (
                        <div className={styles.row}>
                            <dt>
                                <strong>{t('game-rules-first')}</strong>
                                <span>
                                    {next
                                        ? t('game-rules-first-note', {
                                              factor: factorText(next.factor, i18n.language),
                                              from: first.upTo + 1,
                                              to: next.upTo
                                          })
                                        : t('game-rules-first-note-short')}
                                </span>
                            </dt>
                            <dd className={styles.factor}>{factorText(first.factor, i18n.language)}</dd>
                        </div>
                    )}

                    <div className={styles.row}>
                        <dt>
                            <strong>{t('game-rules-photo')}</strong>
                            <span>{t('game-rules-photo-note')}</span>
                        </dt>
                        <dd>
                            <GamePoints
                                value={rules.photoBonus}
                                plus={true}
                                variant={'plain'}
                            />
                        </dd>
                    </div>

                    <div className={styles.row}>
                        <dt>
                            <strong>{t('game-rules-spot')}</strong>
                            <span>{t('game-rules-spot-note')}</span>
                        </dt>
                        <dd>
                            <GamePoints
                                value={rules.spotBonus}
                                plus={true}
                                variant={'plain'}
                            />
                        </dd>
                    </div>
                </dl>

                <ul className={styles.notes}>
                    <li>{t('game-rules-note-once')}</li>
                    <li>
                        {t('game-rules-note-near', {
                            max: formatLength(Math.max(rules.radius, ...radiuses), i18n.language),
                            min: formatLength(Math.min(rules.radius, ...radiuses), i18n.language)
                        })}
                    </li>
                    <li>{t('game-rules-note-privacy')}</li>
                    <li>{t('game-rules-note-season')}</li>
                </ul>
            </div>
        </Container>
    )
}
