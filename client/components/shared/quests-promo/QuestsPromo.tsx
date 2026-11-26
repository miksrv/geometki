import React from 'react'
import { Button, cn } from 'simple-react-ui-kit'

import Image from 'next/image'
import { useTranslation } from 'next-i18next/pages'

import { IMG_HOST } from '@/config/env'
import { QUESTS_HREF } from '@/utils/game'

import styles from './styles.module.sass'

export interface QuestsPromoProps {
    /** The quests waiting for the visitor: said next to the button */
    count?: number
    /** A cover of one of the quests: the picture of the block; a drawn path alone without it */
    cover?: string
    className?: string
}

/**
 * The quests as an invitation, a block on the full width (the game page; made to stand on any
 * page — the home one too): what a quest is in a title and one sentence, the one button that
 * leads to the quests' section and how many there are | the picture — a cover of a quest under
 * a drawn path of numbered points, the look of a quest on the map. It lists nothing: the
 * quests are a section of their own.
 */
export const QuestsPromo: React.FC<QuestsPromoProps> = ({ count = 0, cover, className }) => {
    const { t } = useTranslation()

    return (
        <section className={cn(styles.promo, className)}>
            <div className={styles.text}>
                <span className={styles.overline}>{t('quests-promo-overline')}</span>
                <h2 className={styles.title}>{t('quests-promo-title')}</h2>
                <p className={styles.lede}>{t('quests-promo-text')}</p>

                <div className={styles.actions}>
                    <Button
                        mode={'primary'}
                        size={'medium'}
                        link={QUESTS_HREF}
                        label={t('quests-promo-button')}
                    />
                    {count > 0 && <span className={styles.count}>{t('game-quests-count', { count })}</span>}
                </div>
            </div>

            <div
                className={cn(styles.art, !cover && styles.artPlain)}
                aria-hidden={true}
            >
                {cover && (
                    <Image
                        src={`${IMG_HOST}${cover}`}
                        alt={''}
                        fill
                        sizes={'(max-width: 768px) 100vw, 480px'}
                        style={{ objectFit: 'cover' }}
                    />
                )}

                {/* A quest as the map draws it: a dashed line through numbered points */}
                <svg
                    className={styles.path}
                    viewBox={'0 0 320 160'}
                    preserveAspectRatio={'xMidYMid meet'}
                    focusable={false}
                >
                    <path
                        className={styles.line}
                        d={'M40 118 C 90 40, 130 150, 170 84 S 250 30, 284 52'}
                    />
                    {[
                        { done: true, label: '1', x: 40, y: 118 },
                        { done: true, label: '2', x: 170, y: 84 },
                        { done: false, label: '3', x: 284, y: 52 }
                    ].map(({ x, y, label, done }) => (
                        <g
                            key={label}
                            className={done ? styles.done : styles.next}
                        >
                            <circle
                                cx={x}
                                cy={y}
                                r={15}
                            />
                            <text
                                x={x}
                                y={y + 5}
                                textAnchor={'middle'}
                            >
                                {label}
                            </text>
                        </g>
                    ))}
                </svg>
            </div>
        </section>
    )
}
