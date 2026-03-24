import React from 'react'
import { Button, ButtonProps } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next'

import { API } from '@/api'
import { openAuthDialog } from '@/app/applicationSlice'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'

import styles from './styles.module.sass'

interface BookmarkButtonProps extends ButtonProps {
    placeId?: string
}

export const BookmarkButton: React.FC<BookmarkButtonProps> = ({ placeId, ...props }) => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const [setBookmark, { isLoading: bookmarkPutLoading }] = API.useBookmarksPutPlaceMutation()

    const {
        data: bookmarkData,
        isLoading: bookmarksLoading,
        isFetching
    } = API.useBookmarksGetPlaceQuery({ placeId: placeId! }, { skip: !placeId || !isAuth })

    const loading = bookmarkPutLoading || bookmarksLoading || isFetching

    const handleButtonClick = async (event: React.MouseEvent) => {
        event.stopPropagation()

        if (!isAuth) {
            dispatch(openAuthDialog())
        } else if (isAuth && placeId) {
            const wasBookmarked = bookmarkData?.result
            await setBookmark({ placeId })

            await dispatch(
                Notify({
                    id: 'bookmarkButton',
                    title: '',
                    message: wasBookmarked ? t('geotag-removed-bookmarks') : t('geotag-added-bookmarks'),
                    type: 'success'
                })
            )
        }
    }

    return (
        <Button
            {...props}
            mode={props?.mode ?? 'secondary'}
            icon={bookmarkData?.result ? 'HeartFilled' : 'HeartEmpty'}
            className={styles.bookmarkButton}
            disabled={!placeId || loading}
            loading={loading}
            onClick={handleButtonClick}
        />
    )
}
