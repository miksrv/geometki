import React from 'react'
import { cn } from 'simple-react-ui-kit'

import styles from './styles.module.sass'

export interface SwitchProps {
    label: string
    /** A second line under the label (`row` only) */
    description?: string
    checked?: boolean
    /**
     * `field` — a 40px outlined control with the track before the label, for a toolbar row
     * next to fields; `row` — a full-width row with the label on the left and the track on
     * the right, for a settings list or a sheet
     */
    variant?: 'field' | 'row'
    disabled?: boolean
    className?: string
    onChange?: (checked: boolean) => void
}

/** An on/off control that applies at once (`role="switch"`). A kit primitive candidate */
export const Switch: React.FC<SwitchProps> = ({
    label,
    description,
    checked = false,
    variant = 'field',
    disabled,
    className,
    onChange
}) => (
    <button
        type={'button'}
        role={'switch'}
        aria-checked={checked}
        disabled={disabled}
        className={cn(styles.switch, styles[variant], checked && styles.checked, className)}
        onClick={() => onChange?.(!checked)}
    >
        {variant === 'field' && (
            <span
                className={styles.track}
                aria-hidden={true}
            />
        )}
        <span className={styles.text}>
            {label}
            {variant === 'row' && description && <span className={styles.description}>{description}</span>}
        </span>
        {variant === 'row' && (
            <span
                className={styles.track}
                aria-hidden={true}
            />
        )}
    </button>
)
