import React, { useId } from 'react'
import { cn, Icon } from 'simple-react-ui-kit'

import styles from './styles.module.sass'

export interface RadioButtonProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string
}

// Looks and behaves like the kit's Checkbox: the whole row is the label, the input stays focusable
export const RadioButton: React.FC<RadioButtonProps> = ({ label, id, className, ...props }) => {
    const generatedId = useId()
    const inputId = id ?? generatedId

    return (
        <div className={cn(styles.radioButton, props.disabled && styles.disabled, className)}>
            <label htmlFor={inputId}>
                <span
                    className={cn(styles.formField, props.checked && styles.checked)}
                    aria-hidden={'true'}
                >
                    <Icon name={props.checked ? 'RadioButtonChecked' : 'RadioButtonUnchecked'} />
                </span>
                <input
                    {...props}
                    id={inputId}
                    type={'radio'}
                    className={styles.input}
                />
                {label && <span>{label}</span>}
            </label>
        </div>
    )
}
