import React from 'react'
import { cn } from 'simple-react-ui-kit'

import styles from './styles.module.sass'

interface CounterProps {
    value?: number
    /** Larger values are shown as `{max}+` so the badge keeps its size */
    max?: number
    /** Show 0 too, e.g. "0 of N selected"; by default the counter is hidden at 0 */
    showZero?: boolean
    className?: string
}

export const Counter: React.FC<CounterProps> = ({ value, max, showZero, className }) =>
    value || (showZero && value === 0) ? (
        <div className={cn(className, styles.counter)}>{max !== undefined && value > max ? `${max}+` : value}</div>
    ) : null
