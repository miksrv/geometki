import React from 'react'
import { cn } from 'simple-react-ui-kit'

import styles from './styles.module.sass'

interface CounterProps {
    value?: number
    /** Larger values are shown as `{max}+` so the badge keeps its size */
    max?: number
    className?: string
}

export const Counter: React.FC<CounterProps> = ({ value, max, className }) =>
    value ? (
        <div className={cn(className, styles.counter)}>{max !== undefined && value > max ? `${max}+` : value}</div>
    ) : null
