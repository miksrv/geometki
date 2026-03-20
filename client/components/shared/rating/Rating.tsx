import React, { useState } from 'react'
import { cn, Icon } from 'simple-react-ui-kit'

import styles from './styles.module.sass'

export interface RatingProps {
    value?: number
    voted?: boolean
    disabled?: boolean
    onChange?: (rating: number) => void
}

export const Rating: React.FC<RatingProps> = ({ value, voted, disabled, onChange }) => {
    const [hoverRating, setHoverRating] = useState<number>()

    const showFullStar = (rating: number) =>
        (!hoverRating && value && value >= (rating || 0)) || (hoverRating && hoverRating >= rating)

    return (
        <ul className={styles.rating}>
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
                    <label className={cn(disabled && styles.disabled)}>
                        {showFullStar(rating) ? <Icon name={'StarFilled'} /> : <Icon name={'StarEmpty'} />}
                        <input
                            type={'radio'}
                            value={rating}
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
                </li>
            ))}
        </ul>
    )
}
