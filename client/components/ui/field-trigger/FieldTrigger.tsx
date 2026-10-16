import React from 'react'
import { cn, Icon, IconTypes } from 'simple-react-ui-kit'

import styles from './styles.module.sass'

export interface FieldTriggerProps {
    /** A kit icon before the text */
    icon?: IconTypes
    /** A quiet name of the field before the value ("Где") */
    label?: string
    value: string
    /** Something is chosen: outlined in `--color-main` */
    active?: boolean
    className?: string
}

/**
 * The face of a dropdown that looks like a field: a 40px outlined box with an icon, an
 * optional name, the current value and a chevron — "Где  Везде ⌄". Pass it as the `trigger`
 * of a kit `Popout`, which is the button (focus, Enter, `aria-expanded`), so the face itself
 * is not interactive. A kit primitive candidate (`Select` has no custom trigger).
 */
export const FieldTrigger: React.FC<FieldTriggerProps> = ({ icon, label, value, active, className }) => (
    <span className={cn(styles.fieldTrigger, active && styles.active, className)}>
        {icon && (
            <Icon
                name={icon}
                className={styles.icon}
            />
        )}
        {label && <span className={styles.label}>{label}</span>}
        <span className={styles.value}>{value}</span>
        <Icon
            name={'KeyboardDown'}
            className={styles.chevron}
        />
    </span>
)
