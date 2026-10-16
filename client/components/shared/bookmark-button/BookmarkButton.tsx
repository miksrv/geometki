import React from 'react'
import { Button, ButtonProps } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { useBookmark } from './useBookmark'

interface BookmarkButtonProps extends ButtonProps {
    placeId?: string
    className?: string
    hideLabel?: boolean
    /** How many people saved the place: shown after the label ("Сохранить · 12") */
    count?: number
}

export const BookmarkButton: React.FC<BookmarkButtonProps> = ({ placeId, className, hideLabel, count, ...props }) => {
    const { t } = useTranslation()

    const { bookmarked, loading, toggle } = useBookmark(placeId)

    const handleButtonClick = (event: React.MouseEvent) => {
        event.stopPropagation()
        void toggle()
    }

    const stateLabel = bookmarked
        ? t('bookmark_added', { defaultValue: 'В закладках' })
        : t('bookmark_add', { defaultValue: 'В закладки' })

    return (
        <Button
            {...props}
            mode={bookmarked ? 'primary' : (props?.mode ?? 'secondary')}
            icon={'Bookmark'}
            label={hideLabel ? undefined : count ? `${stateLabel} · ${count}` : stateLabel}
            tooltip={stateLabel}
            className={className}
            disabled={!placeId || loading}
            loading={loading}
            onClick={handleButtonClick}
        />
    )
}
