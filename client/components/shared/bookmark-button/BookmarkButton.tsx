import React, { useEffect, useState } from 'react'
import { Button, ButtonProps } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next'

import { API, useAppDispatch, useAppSelector } from '@/api'
import { openAuthDialog } from '@/api/applicationSlice'
import { Notify } from '@/api/notificationSlice'

import styles from './styles.module.sass'

interface BookmarkButtonProps extends ButtonProps {
    placeId?: string
}

export const BookmarkButton: React.FC<BookmarkButtonProps> = ({ placeId, ...props }) => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const [buttonPushed, setButtonPushed] = useState<boolean>(false)

    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const [setBookmark, { isLoading: bookmarkPutLoading, data: result }] = API.useBookmarksPutPlaceMutation()

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
            await setBookmark({ placeId })
            setButtonPushed(true)
        }
    }

    useEffect(() => {
        if (!buttonPushed) {
            return
        }

        void dispatch(
            Notify({
                id: 'bookmarkButton',
                title: '',
                message: bookmarkData?.result ? t('geotag-removed-bookmarks') : t('geotag-added-bookmarks'),
                type: 'success'
            })
        )
    }, [result])

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
