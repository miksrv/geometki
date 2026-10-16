import React from 'react'
import { cn } from 'simple-react-ui-kit'

import styles from './styles.module.sass'

interface CounterProps {
    value?: number
    /** Larger values are shown as `{max}+` so the badge keeps its size */
    max?: number
    /** Show 0 too, e.g. "0 of N selected"; by default the counter is hidden at 0 */
    showZero?: boolean
    /** `red` (default) — unread, new; `main` — how many are set (filters, categories) */
    color?: 'red' | 'main'
    /** The number is already in the control's accessible name: hide the pill from readers */
    'aria-hidden'?: boolean
    className?: string
}

/**
 * The count over an icon button (the bell, the phone filters button, the map controls): an
 * 18px pill in the corner. Where it sits is the parent's business (`className`).
 */
export const Counter: React.FC<CounterProps> = ({
    value,
    max,
    showZero,
    color = 'red',
    'aria-hidden': ariaHidden,
    className
}) =>
    value || (showZero && value === 0) ? (
        <div
            className={cn(className, styles.counter, color === 'main' && styles.main)}
            aria-hidden={ariaHidden}
        >
            {max !== undefined && value > max ? `${max}+` : value}
        </div>
    ) : null
