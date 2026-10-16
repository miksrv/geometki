import { useTranslation } from 'next-i18next/pages'
import { FetchBaseQueryError } from '@reduxjs/toolkit/query'

import { API } from '@/api'
import { openAuthDialog } from '@/app/applicationSlice'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { getErrorMessage } from '@/utils/api'

/**
 * The visitor's bookmark of a place: whether it is set and the toggle (the auth dialog for
 * guests, a toast with the result). Behind `BookmarkButton` and the "Сохранить" menu of the
 * place page.
 */
export const useBookmark = (placeId?: string) => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const [setBookmark, { isLoading: putLoading }] = API.useBookmarksPutPlaceMutation()

    const { data, isLoading, isFetching } = API.useBookmarksGetPlaceQuery(
        { placeId: placeId! },
        { skip: !placeId || !isAuth }
    )

    const bookmarked = !!data?.result

    const toggle = async () => {
        if (!isAuth) {
            dispatch(openAuthDialog())
            return
        }

        if (!placeId) {
            return
        }

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
                    message: bookmarked ? t('geotag-removed-bookmarks') : t('geotag-added-bookmarks'),
                    type: 'success'
                })
            )
        }
    }

    return { bookmarked, loading: putLoading || isLoading || isFetching, toggle }
}
