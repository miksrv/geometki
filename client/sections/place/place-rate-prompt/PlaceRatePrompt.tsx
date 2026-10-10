import React, { useEffect, useState } from 'react'
import { Button } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { Rating } from '@/components/shared'
import { getErrorMessage } from '@/utils/api'

import { RATE_ANCHOR } from '../place-hero/PlaceHero'

import styles from './styles.module.sass'

interface PlaceRatePromptProps {
    placeId?: string
    /** The author cannot rate their own place (the server refuses it too) */
    authorId?: string
}

/**
 * "Были здесь? Оцените место" after the description — where the reader has formed an
 * opinion. The stars here are an input: empty until hovered, with a word for each score;
 * the average lives in the hero facts line, never on these stars. After a vote the row
 * shows the reader's own score with "Изменить" (the server updates the same vote).
 */
export const PlaceRatePrompt: React.FC<PlaceRatePromptProps> = ({ placeId, authorId }) => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const userId = useAppSelector((state) => state.auth.user?.id)

    const { data: ratingData, isLoading } = API.useRatingGetListQuery(placeId ?? '', { skip: !placeId })
    const [changeRating, { isLoading: ratingLoading, isSuccess, error: ratingError }] = API.useRatingPutScoreMutation()

    const [editing, setEditing] = useState<boolean>(false)

    const isOwnPlace = !!userId && !!authorId && userId === authorId
    const vote = ratingData?.vote ?? undefined

    const labels = [
        t('rating-label-1', { defaultValue: 'Плохо' }),
        t('rating-label-2', { defaultValue: 'Так себе' }),
        t('rating-label-3', { defaultValue: 'Нормально' }),
        t('rating-label-4', { defaultValue: 'Хорошо' }),
        t('rating-label-5', { defaultValue: 'Отлично' })
    ]

    const handleRatingChange = async (value?: number) => {
        if (value && placeId) {
            await changeRating({ place: placeId, score: value })
        }
    }

    useEffect(() => {
        if (isSuccess) {
            setEditing(false)

            void dispatch(
                Notify({
                    id: 'placeRating',
                    title: '',
                    message: t('thank-you-for-rating'),
                    type: 'success'
                })
            )
        }
    }, [isSuccess])

    useEffect(() => {
        if (ratingError) {
            void dispatch(
                Notify({
                    id: 'ratingError',
                    message: getErrorMessage(ratingError),
                    type: 'error'
                })
            )
        }
    }, [ratingError])

    // The author cannot rate the place (the server refuses it too): no prompt, and the
    // rating in the hero is a plain fact for them, not a link here
    if (isOwnPlace) {
        return null
    }

    return (
        <section
            id={RATE_ANCHOR}
            className={styles.prompt}
            aria-label={t('rate-this-place', { defaultValue: 'Оценить место' })}
        >
            {vote && !editing ? (
                <>
                    <span className={styles.text}>{t('rating-your-score', { defaultValue: 'Ваша оценка' })}</span>
                    <Rating
                        value={vote}
                        voted={true}
                        disabled={true}
                        labels={labels}
                    />
                    <Button
                        mode={'link'}
                        size={'small'}
                        label={t('change', { defaultValue: 'Изменить' })}
                        onClick={() => setEditing(true)}
                    />
                </>
            ) : (
                <>
                    <span className={styles.text}>
                        <strong>{t('rating-prompt-question', { defaultValue: 'Были здесь?' })}</strong>{' '}
                        {t('rating-prompt', { defaultValue: 'Оцените место' })}
                    </span>
                    <Rating
                        labels={labels}
                        disabled={isLoading || ratingLoading}
                        onChange={handleRatingChange}
                    />
                    {editing && (
                        <Button
                            mode={'link'}
                            size={'small'}
                            label={t('cancel')}
                            onClick={() => setEditing(false)}
                        />
                    )}
                </>
            )}
        </section>
    )
}
