import React from 'react'

import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { featureOfQuestion } from '@/api/models/visitQuestion'
import { formatPlainDate } from '@/utils/date'
import { isKnownAnswer } from '@/utils/visitQuestions'

import styles from './styles.module.sass'

interface PlaceNowProps {
    placeId?: string
}

/**
 * "Как сейчас": what the visitors say about the place, one row per question (road, entry, state…):
 * the latest answer, how many answers of the last years agree with it and the day, and under it
 * the earlier years when they said something else; the features (`can_*`) are two last rows,
 * "Можно купаться · рыбачить" and "Нельзя костёр", with the day of the latest answer, the
 * agreement of each one in its `title`. Hidden until somebody has answered. The query
 * is the one of `PlaceVisitors`, prefetched with the place page (`loadPlacePage`).
 */
export const PlaceNow: React.FC<PlaceNowProps> = ({ placeId }) => {
    const { t } = useTranslation()

    const { data } = API.useVisitsGetListQuery({ limit: 1, place: placeId }, { skip: !placeId })

    const known = (data?.now ?? []).filter((item) => isKnownAnswer(item.question, item.value))
    const items = known.filter((item) => featureOfQuestion(item.question) === undefined)
    const features = known.filter((item) => featureOfQuestion(item.question) !== undefined)
    const featureRows = [
        { items: features.filter((item) => item.value === 'yes'), title: t('visitQuestions.can.title') },
        {
            items: features.filter((item) => item.value === 'no'),
            title: t('place-now-cannot', { defaultValue: 'Нельзя' })
        }
    ].filter((row) => row.items.length)

    if (!known.length) {
        return null
    }

    const valueText = (question: string, value: string) => t(`visitQuestions.${question}.values.${value}`)

    return (
        <section
            className={styles.now}
            aria-label={t('place-now-title', { defaultValue: 'Как сейчас' })}
        >
            <h3 className={styles.title}>{t('place-now-title', { defaultValue: 'Как сейчас' })}</h3>

            {items.map((item) => {
                const history = item.history.filter((entry) => isKnownAnswer(item.question, entry.value))

                return (
                    <div
                        key={item.question}
                        className={styles.item}
                    >
                        <p className={styles.main}>
                            <strong>{t(`visitQuestions.${item.question}.title`)}</strong>{' '}
                            {valueText(item.question, item.value)}
                        </p>
                        <p className={styles.quiet}>
                            {t('place-now-agree', { agree: item.agree, total: item.total })} ·{' '}
                            {formatPlainDate(item.visitedAt)}
                        </p>
                        {!!history.length && (
                            <p className={styles.quiet}>
                                {history
                                    .map((entry) =>
                                        t('place-now-history', {
                                            value: valueText(item.question, entry.value),
                                            year: entry.year
                                        })
                                    )
                                    .join(' · ')}
                            </p>
                        )}
                    </div>
                )
            })}

            {featureRows.map((row) => (
                <div
                    key={row.title}
                    className={styles.item}
                >
                    <p className={styles.main}>
                        <strong>{row.title}</strong>{' '}
                        {row.items.map((item, index) => (
                            <React.Fragment key={item.question}>
                                {index > 0 && ' · '}
                                <span title={t('place-now-agree', { agree: item.agree, total: item.total })}>
                                    {t(`visitFeatures.${featureOfQuestion(item.question)}`)}
                                </span>
                            </React.Fragment>
                        ))}
                    </p>
                    <p className={styles.quiet}>
                        {formatPlainDate(row.items.map((item) => item.visitedAt).sort()[row.items.length - 1])}
                    </p>
                </div>
            ))}
        </section>
    )
}
