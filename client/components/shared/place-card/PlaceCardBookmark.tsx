import React from 'react'
import { cn, Icon } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { useAppSelector } from '@/app/store'
import { useBookmark } from '@/components/shared/bookmark-button/useBookmark'

import styles from './styles.module.sass'

interface PlaceCardBookmarkProps {
    placeId: string
    /** `PlaceListItem.bookmarked`: sent by `GET /places` for a signed-in visitor only */
    known?: boolean
}

/**
 * The one-tap bookmark over a tile's cover. A guest gets it too (a tap opens the sign-in
 * dialog); a signed-in visitor only where the list says whether the place is bookmarked —
 * a request per card is not worth an icon.
 */
export const PlaceCardBookmark: React.FC<PlaceCardBookmarkProps> = ({ placeId, known }) => {
    const { t } = useTranslation()
    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const { bookmarked, loading, toggle } = useBookmark(placeId, isAuth ? known : false)

    if (isAuth && known === undefined) {
        return null
    }

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
            disabled={loading}
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
