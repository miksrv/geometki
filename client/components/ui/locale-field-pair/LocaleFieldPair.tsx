import React from 'react'
import { Control, Controller, FieldPathValue, FieldValues, Path } from 'react-hook-form'
import { Input, TextArea } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import styles from './styles.module.sass'

export interface LocaleFieldPairProps<T extends FieldValues> {
    control: Control<T>
    /** The Russian and the English field of the form: `title_ru`, `title_en` */
    names: [Path<T>, Path<T>]
    /** "Название": the language is added to it ("Название (русский)") */
    label: string
    /** A text area instead of a line */
    rows?: number
    /** Which of the two must be filled in */
    required?: { ru?: boolean; en?: boolean }
    maxLength?: number
    disabled?: boolean
    autoFocus?: boolean
}

const LOCALES = ['ru', 'en'] as const

/**
 * The Russian and the English version of one text, side by side (stacked on phones), each
 * labelled with its language in words ("Название (русский)"). Inline errors come from the form's
 * rules: a required one is checked here, the rest is the form's (`setError`).
 */
export const LocaleFieldPair = <T extends FieldValues>({
    control,
    names,
    label,
    rows,
    required,
    maxLength,
    disabled,
    autoFocus
}: LocaleFieldPairProps<T>) => {
    const { t } = useTranslation()

    return (
        <div className={styles.pair}>
            {LOCALES.map((locale, index) => (
                <Controller
                    key={locale}
                    name={names[index]}
                    control={control}
                    rules={{
                        maxLength: maxLength
                            ? { message: t('admin-field-too-long', { max: maxLength }), value: maxLength }
                            : undefined,
                        validate: required?.[locale]
                            ? (value) => !!String(value ?? '').trim() || t('admin-field-required')
                            : undefined
                    }}
                    render={({ field, fieldState }) => {
                        const common = {
                            disabled,
                            error: fieldState.error?.message,
                            label: `${label} (${t(`language-name-${locale}`)})`,
                            maxLength,
                            name: field.name,
                            onBlur: field.onBlur,
                            required: required?.[locale],
                            value: String((field.value as FieldPathValue<T, Path<T>> | undefined) ?? '')
                        }

                        return rows ? (
                            <TextArea
                                {...common}
                                rows={rows}
                                onChange={field.onChange}
                            />
                        ) : (
                            <Input
                                {...common}
                                size={'medium'}
                                autoFocus={autoFocus && index === 0}
                                onChange={field.onChange}
                            />
                        )
                    }}
                />
            ))}
        </div>
    )
}
