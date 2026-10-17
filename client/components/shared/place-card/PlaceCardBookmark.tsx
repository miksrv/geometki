import React from 'react'
import { cn, Icon } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { useAppSelector } from '@/app/store'
import { useBookmark } from '@/components/shared/bookmark-button/useBookmark'

import styles from './styles.module.sass'

interface PlaceCardBookmarkProps {
    placeId: string
    /** `PlaceListItem.bookmarked` of the list (places, search, the feed, a collection) */
    known?: boolean
}

/**
 * The one-tap bookmark over a tile's cover, on a tile of any list. A guest's tap opens the
 * sign-in dialog; a signed-in visitor's state is the list's own field (`known`); a list without it
 * asks `GET /bookmarks/places` — one request for all such cards,
 * refreshed by every bookmark toggle. A toggle here is kept by `useBookmark` itself.
 */
export const PlaceCardBookmark: React.FC<PlaceCardBookmarkProps> = ({ placeId, known }) => {
    const { t } = useTranslation()
    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const { data: saved, isLoading: savedLoading } = API.useBookmarksGetPlacesQuery(undefined, {
        skip: !isAuth || known !== undefined
    })

    const state = isAuth ? (saved ? saved.items.includes(placeId) : known) : false
    const { bookmarked, loading, toggle } = useBookmark(placeId, state ?? false)

    const label = bookmarked
        ? t('bookmark_added', { defaultValue: 'В закладках' })
        : t('bookmark_add', { defaultValue: 'В закладки' })

    return (
        <button
            type={'button'}
            className={cn(styles.tileBookmark, bookmarked && styles.tileBookmarkOn)}
            aria-label={label}
            aria-pressed={bookmarked}
            title={label}
            disabled={loading || (isAuth && savedLoading && state === undefined)}
            onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                void toggle()
            }}
        >
            <Icon name={'Bookmark'} />
        </button>
    )
}
