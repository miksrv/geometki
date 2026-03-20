'use client'

import React, { useEffect, useState } from 'react'
import {
    OKIcon,
    OKShareButton,
    RedditIcon,
    RedditShareButton,
    TelegramIcon,
    TelegramShareButton,
    ViberIcon,
    ViberShareButton,
    VKIcon,
    VKShareButton,
    WhatsappIcon,
    WhatsappShareButton
} from 'react-share'
import { Container, Dialog, Spinner } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next'

import { API } from '@/api'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { toggleOverlay } from '@/app/applicationSlice'
import { Notify } from '@/app/notificationSlice'
import { Rating, UserAvatar } from '@/components/shared'
import { addDecimalPoint, formatDate } from '@/utils/helpers'

import styles from './styles.module.sass'

interface SocialRatingProps {
    placeId?: string
    placeUrl?: string
}

export const PlaceShareButtons: React.FC<SocialRatingProps> = ({ placeId, placeUrl }) => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const [openRatingHistory, setOpenRatingHistory] = useState<boolean>(false)

    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const { data: ratingData, isLoading } = API.useRatingGetListQuery(placeId ?? '', {
        skip: !placeId,
        refetchOnMountOrArgChange: true
    })

    const { data: ratingHistoryData, isFetching: loadingRatingHistory } = API.useRatingGetHistoryQuery(
        { placeId: placeId },
        {
            skip: !placeId || !openRatingHistory,
            refetchOnMountOrArgChange: true
        }
    )

    const [changeRating, { isLoading: ratingLoading, isSuccess }] = API.useRatingPutScoreMutation()

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

    return (
        <Container className={styles.shareSocial}>
            <div className={styles.rating}>
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

            <div className={styles.share}>
                <TelegramShareButton url={placeUrl!}>
                    <TelegramIcon size={22} />
                </TelegramShareButton>

                <WhatsappShareButton url={placeUrl!}>
                    <WhatsappIcon size={22} />
                </WhatsappShareButton>

                <ViberShareButton url={placeUrl!}>
                    <ViberIcon size={22} />
                </ViberShareButton>

                <VKShareButton url={placeUrl!}>
                    <VKIcon size={22} />
                </VKShareButton>

                <OKShareButton url={placeUrl!}>
                    <OKIcon size={22} />
                </OKShareButton>

                <RedditShareButton url={placeUrl!}>
                    <RedditIcon size={22} />
                </RedditShareButton>
            </div>

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
