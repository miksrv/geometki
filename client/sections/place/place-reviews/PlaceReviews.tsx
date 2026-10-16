import React from 'react'
import { cn, Container, Icon } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { Section } from '@/components/shared'
import { addDecimalPoint } from '@/utils/helpers'

import { CommentList } from '../place-comment-list/CommentList'
import { REVIEWS_ANCHOR } from '../place-hero/PlaceHero'
import { PlaceRatePrompt } from '../place-rate-prompt/PlaceRatePrompt'

import styles from './styles.module.sass'

const SCORES = [5, 4, 3, 2, 1]

interface PlaceReviewsProps {
    placeId?: string
    /** The author cannot rate their own place: no "Ваша оценка" row for them */
    authorId?: string
}

/**
 * "Оценки и отзывы" — one block, like on the big maps: the average with five read-only stars
 * and the count, the bars of the scores 5 to 1, the reader's own score in one tap
 * (`PlaceRatePrompt`, anchor `#rate`) and the reviews with the field to write one. The facts
 * line of the hero links here (`#reviews`).
 */
export const PlaceReviews: React.FC<PlaceReviewsProps> = ({ placeId, authorId }) => {
    const { t } = useTranslation()

    const { data: ratingData } = API.useRatingGetListQuery(placeId ?? '', { skip: !placeId })

    const count = ratingData?.count ?? 0
    const rating = ratingData?.rating ?? 0
    const rounded = Math.round(rating)
    const distribution = ratingData?.distribution
    const maxVotes = Math.max(1, ...SCORES.map((score) => distribution?.[score] ?? 0))

    return (
        <Section
            id={REVIEWS_ANCHOR}
            className={styles.section}
            title={t('place-reviews-title', { defaultValue: 'Оценки и отзывы' })}
        >
            <Container className={styles.card}>
                {count ? (
                    <div className={styles.summary}>
                        <div className={styles.score}>
                            <strong>{addDecimalPoint(rating)}</strong>
                            <span
                                className={styles.stars}
                                role={'img'}
                                aria-label={t('rating-n-of-5', {
                                    value: addDecimalPoint(rating),
                                    defaultValue: 'Рейтинг {{value}} из 5'
                                })}
                            >
                                {SCORES.map((score) => (
                                    <Icon
                                        key={score}
                                        name={'StarFilled'}
                                        className={cn(6 - score <= rounded && styles.on)}
                                    />
                                ))}
                            </span>
                            <small>{t('place-votes-count', { count, defaultValue: '{{count}} оценок' })}</small>
                        </div>

                        {distribution && (
                            <ul
                                className={styles.bars}
                                aria-label={t('rating-distribution', { defaultValue: 'Распределение оценок' })}
                            >
                                {SCORES.map((score) => {
                                    const votes = distribution[score] ?? 0

                                    return (
                                        <li
                                            key={score}
                                            aria-label={t('rating-distribution-row', {
                                                score,
                                                count: votes,
                                                defaultValue: '{{score}}: {{count}}'
                                            })}
                                        >
                                            <span aria-hidden={true}>{score}</span>
                                            <i
                                                aria-hidden={true}
                                                style={
                                                    { '--share': `${(votes / maxVotes) * 100}%` } as React.CSSProperties
                                                }
                                            />
                                            <span aria-hidden={true}>{votes}</span>
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </div>
                ) : (
                    <p className={styles.noVotes}>{t('place-no-votes-yet', { defaultValue: 'Оценок пока нет' })}</p>
                )}

                <PlaceRatePrompt
                    placeId={placeId}
                    authorId={authorId}
                />

                <div className={styles.reviews}>
                    <CommentList placeId={placeId} />
                </div>
            </Container>
        </Section>
    )
}
