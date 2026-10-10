import React, { useId, useState } from 'react'
import { cn, Icon, Tooltip } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import styles from './styles.module.sass'

export interface RatingProps {
    className?: string
    value?: number
    voted?: boolean
    disabled?: boolean
    /**
     * Word for each score, 1 to 5 ("Плохо" … "Отлично"): shown next to the stars for the
     * hovered score, or for `value` when nothing is hovered. Makes the stars read as an
     * input (the rate prompt of the place page), not as an indicator.
     */
    labels?: string[]
    onChange?: (rating: number) => void
}

export const Rating: React.FC<RatingProps> = ({ className, value, voted, disabled, labels, onChange }) => {
    const { t } = useTranslation('components.shared.rating')
    const groupName = useId()
    const [hoverRating, setHoverRating] = useState<number>()

    const showFullStar = (rating: number) =>
        (!hoverRating && value && value >= (rating || 0)) || (hoverRating && hoverRating >= rating)

    const labelScore = hoverRating ?? value
    const label = labels && labelScore ? labels[labelScore - 1] : undefined

    const stars = (
        <ul
            className={cn(styles.rating, !labels && className)}
            role={'radiogroup'}
            aria-label={t('rate-this-place', { defaultValue: 'Оценить место' })}
        >
            {[1, 2, 3, 4, 5].map((rating) => (
                <li
                    key={`ratingItem${rating}`}
                    className={cn(
                        hoverRating && hoverRating >= rating ? styles.hovered : undefined,
                        voted && styles.voted,
                        hoverRating === rating && styles.current
                    )}
                    onMouseEnter={() => {
                        if (!disabled) {
                            setHoverRating(rating)
                        }
                    }}
                    onMouseLeave={() => {
                        if (!disabled) {
                            setHoverRating(undefined)
                        }
                    }}
                >
                    <Tooltip
                        content={t('rate-n-of-5', { defaultValue: 'Оценить {{count}} из 5', count: rating })}
                        disabled={disabled}
                    >
                        <label className={cn(disabled && styles.disabled)}>
                            {showFullStar(rating) ? <Icon name={'StarFilled'} /> : <Icon name={'StarEmpty'} />}
                            <input
                                type={'radio'}
                                name={groupName}
                                value={rating}
                                checked={value === rating}
                                disabled={disabled}
                                aria-label={t('rate-n-of-5', {
                                    defaultValue: 'Оценить {{count}} из 5',
                                    count: rating
                                })}
                                onChange={() => {
                                    if (!disabled) {
                                        onChange?.(rating)
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
                                        onChange?.(rating)
                                    }
                                }}
                            />
                        </label>
                    </Tooltip>
                </li>
            ))}
        </ul>
    )

    if (!labels) {
        return stars
    }

    return (
        <div className={cn(styles.withLabels, className)}>
            {stars}
            <span
                className={cn(styles.label, !label && styles.labelEmpty)}
                aria-live={'polite'}
            >
                {label}
            </span>
        </div>
    )
}
