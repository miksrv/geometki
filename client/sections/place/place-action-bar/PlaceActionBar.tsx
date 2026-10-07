import React, { useEffect } from 'react'
import { Container, Spinner } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'
import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { Rating, WasHereButton } from '@/components/shared'
import { getErrorMessage } from '@/utils/api'
import { addDecimalPoint } from '@/utils/helpers'

import styles from './styles.module.sass'

const ShareButtons = dynamic(() => import('./ShareButtons'), { ssr: false })

interface PlaceActionBarProps {
    placeId?: string
    placeUrl?: string
    bookmarks?: number
    verificationExempt?: boolean
}

export const PlaceActionBar: React.FC<PlaceActionBarProps> = ({ placeId, placeUrl, bookmarks, verificationExempt }) => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const { data: ratingData, isLoading } = API.useRatingGetListQuery(placeId ?? '', {
        skip: !placeId
    })

    const [changeRating, { isLoading: ratingLoading, isSuccess, error: ratingError }] = API.useRatingPutScoreMutation()

    const handleRatingChange = async (value?: number) => {
        if (value && placeId) {
            await changeRating({
                place: placeId,
                score: value
            })
        }
    }

    useEffect(() => {
        if (isSuccess && !ratingData?.vote && !isAuth) {
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

    return (
        <Container className={styles.actionBar}>
            <WasHereButton
                placeId={placeId}
                verificationExempt={verificationExempt}
            />

            <div className={styles.rating}>
                {!!ratingData?.count && (
                    <span className={styles.ratingScore}>
                        {ratingLoading ? (
                            <Spinner className={styles.ratingLoader} />
                        ) : (
                            addDecimalPoint(ratingData.rating)
                        )}
                    </span>
                )}

                <Rating
                    value={ratingData?.rating}
                    voted={!!ratingData?.vote}
                    disabled={ratingLoading || isLoading || !!ratingData?.vote}
                    onChange={handleRatingChange}
                />

                {!!ratingData?.count && <span className={styles.ratingCount}>({ratingData.count})</span>}
            </div>

            {!!bookmarks && bookmarks > 0 && (
                <div className={styles.bookmarks}>
                    {t('in-bookmarks')} <strong>{bookmarks}</strong>
                </div>
            )}

            {placeUrl && <ShareButtons placeUrl={placeUrl} />}
        </Container>
    )
}
