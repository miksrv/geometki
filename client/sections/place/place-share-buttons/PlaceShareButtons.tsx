import React, { useEffect, useState } from 'react'
import { Container, Dialog, Spinner } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'
import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { toggleOverlay } from '@/app/applicationSlice'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { Rating, UserAvatar, WasHereButton } from '@/components/shared'
import { getErrorMessage } from '@/utils/api'
import { addDecimalPoint, formatDate } from '@/utils/helpers'

import styles from './styles.module.sass'

const ShareButtons = dynamic(() => import('./ShareButtons'), { ssr: false })

interface SocialRatingProps {
    placeId?: string
    placeUrl?: string
    verificationExempt?: boolean
}

export const PlaceShareButtons: React.FC<SocialRatingProps> = ({ placeId, placeUrl, verificationExempt }) => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const [openRatingHistory, setOpenRatingHistory] = useState<boolean>(false)

    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const { data: ratingData, isLoading } = API.useRatingGetListQuery(placeId ?? '', {
        skip: !placeId
    })

    const { data: ratingHistoryData, isFetching: loadingRatingHistory } = API.useRatingGetHistoryQuery(
        { placeId: placeId },
        {
            skip: !placeId || !openRatingHistory
        }
    )

    const [changeRating, { isLoading: ratingLoading, isSuccess, error: ratingError }] = API.useRatingPutScoreMutation()

    const handleRatingChange = async (value?: number) => {
        if (value && placeId) {
            await changeRating({
                place: placeId,
                score: value
            })
        }
    }

    const handleToggleRatingHistory = (state: boolean) => {
        dispatch(toggleOverlay(state))
        setOpenRatingHistory(state)
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
        <Container className={styles.shareSocial}>
            <div className={styles.rating}>
                <WasHereButton
                    placeId={placeId}
                    verificationExempt={verificationExempt}
                />

                <Rating
                    value={ratingData?.rating}
                    voted={!!ratingData?.vote}
                    disabled={ratingLoading || isLoading}
                    onChange={handleRatingChange}
                />

                <div className={styles.ratingValue}>
                    {isLoading || ratingLoading ? (
                        <Spinner />
                    ) : ratingData?.count ? (
                        <span
                            role={'button'}
                            className={styles.ratingHistoryButton}
                            onClick={() => handleToggleRatingHistory(true)}
                        >
                            {addDecimalPoint(ratingData?.rating)}
                        </span>
                    ) : (
                        ''
                    )}
                </div>
            </div>

            {placeUrl && <ShareButtons placeUrl={placeUrl} />}

            <Dialog
                open={openRatingHistory}
                onCloseDialog={() => handleToggleRatingHistory(false)}
            >
                {loadingRatingHistory ? (
                    <div className={styles.ratingHistoryLoading}>
                        <Spinner />
                    </div>
                ) : (
                    <ul>
                        {ratingHistoryData?.items?.map((item, i) => (
                            <li
                                key={`rating-history-${i}`}
                                className={styles.ratingHistoryItem}
                            >
                                <UserAvatar
                                    className={styles.avatar}
                                    user={item?.author}
                                    disableLink={true}
                                    size={'medium'}
                                />
                                <div>
                                    <div className={styles.user}>{item?.author?.name || 'Гость'}</div>
                                    <div>
                                        {t('rating')}: <b>{item.value}</b>
                                    </div>
                                </div>
                                <div className={styles.date}>{formatDate(item?.created?.date)}</div>
                            </li>
                        ))}
                    </ul>
                )}
            </Dialog>
        </Container>
    )
}
