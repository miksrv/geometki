import React from 'react'
import { Button, ButtonProps } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'
import { FetchBaseQueryError } from '@reduxjs/toolkit/query'

import { API } from '@/api'
import { openAuthDialog } from '@/app/applicationSlice'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { getErrorMessage } from '@/utils/api'

interface BookmarkButtonProps extends ButtonProps {
    placeId?: string
    className?: string
    hideLabel?: boolean
}

export const BookmarkButton: React.FC<BookmarkButtonProps> = ({ placeId, className, hideLabel, ...props }) => {
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
            const result = await setBookmark({ placeId })

            if ('error' in result) {
                void dispatch(
                    Notify({
                        id: 'bookmarkError',
                        message: getErrorMessage(result.error as FetchBaseQueryError),
                        type: 'error'
                    })
                )
            } else {
                void dispatch(
                    Notify({
                        id: 'bookmarkButton',
                        title: '',
                        message: wasBookmarked ? t('geotag-removed-bookmarks') : t('geotag-added-bookmarks'),
                        type: 'success'
                    })
                )
            }
        }
    }

    return (
        <Button
            {...props}
            mode={bookmarkData?.result ? 'primary' : (props?.mode ?? 'secondary')}
            icon={'Bookmark'}
            label={
                hideLabel
                    ? undefined
                    : bookmarkData?.result
                      ? t('bookmark_added', { defaultValue: 'В закладках' })
                      : t('bookmark_add', { defaultValue: 'В закладки' })
            }
            className={className}
            disabled={!placeId || loading}
            loading={loading}
            onClick={handleButtonClick}
        />
    )
}
