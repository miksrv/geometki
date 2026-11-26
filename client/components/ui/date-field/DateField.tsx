import React, { useId } from 'react'
import { cn, DatePicker } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import styles from './styles.module.sass'

export interface DateFieldProps {
    label: string
    /** The day, `YYYY-MM-DD`; empty while none is chosen */
    value?: string
    onChange: (value: string) => void
    /** The first and the last day that can be chosen, `YYYY-MM-DD` */
    minDate?: string
    maxDate?: string
    required?: boolean
    disabled?: boolean
    error?: string
    className?: string
}

/**
 * A form field of one day: the kit's field label, the kit `DatePicker` (a calendar in a popout,
 * one day, no presets) stretched to a full-width field of the `medium` height, and the error
 * under it like under an `Input`. The kit picker has no label
 * and no error of its own — a candidate for the kit.
 */
export const DateField: React.FC<DateFieldProps> = ({
    label,
    value,
    onChange,
    minDate,
    maxDate,
    required,
    disabled,
    error,
    className
}) => {
    const { t, i18n } = useTranslation()
    const id = useId()

    return (
        <div
            className={cn(styles.field, required && styles.required, disabled && styles.disabled, className)}
            role={'group'}
            aria-labelledby={id}
        >
            <span
                id={id}
                className={styles.label}
            >
                {label}
            </span>

            <div className={styles.picker}>
                <DatePicker
                    buttonMode={'outline'}
                    locale={i18n.language === 'en' ? 'en' : 'ru'}
                    datePeriod={[value || undefined, value || undefined]}
                    minDate={minDate}
                    maxDate={maxDate}
                    disabled={disabled}
                    placeholder={t('date-field-placeholder')}
                    showTodayButton={true}
                    onDateSelect={onChange}
                />
            </div>

            {error && (
                <div
                    className={styles.error}
                    role={'alert'}
                >
                    {error}
                </div>
            )}
        </div>
    )
}
