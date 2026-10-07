import React, { useEffect, useMemo, useRef } from 'react'
import { Controller, FieldErrors, useForm } from 'react-hook-form'
import { Button, Input, Message } from 'simple-react-ui-kit'

import { useRouter } from 'next/dist/client/router'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiType } from '@/api'
import { closeAuthDialog } from '@/app/applicationSlice'
import { login } from '@/app/authSlice'
import { useAppDispatch } from '@/app/store'
import { isApiValidationErrors } from '@/utils/api'
import { validateEmail } from '@/utils/validators'

import styles from './styles.module.sass'

type FormDataType = Required<ApiType.Auth.PostRegistrationRequest> & {
    repeat_password: string
}

const FIELDS = ['name', 'email', 'password', 'repeat_password'] as const

interface RegistrationFormProps {
    onClickLogin?: () => void
}

export const RegistrationForm: React.FC<RegistrationFormProps> = ({ onClickLogin }) => {
    const { t } = useTranslation('components.app-bar.registration-form')
    const dispatch = useAppDispatch()
    const router = useRouter()

    const {
        control,
        formState: { errors: formErrors },
        getValues,
        handleSubmit,
        setError
    } = useForm<FormDataType>({ defaultValues: { email: '', name: '', password: '', repeat_password: '' } })

    // Input (simple-react-ui-kit) doesn't forward a ref to the underlying <input>, so the
    // wrapping element is used to find and focus it after a failed validation.
    const fieldRefs = {
        email: useRef<HTMLDivElement>(null),
        name: useRef<HTMLDivElement>(null),
        password: useRef<HTMLDivElement>(null),
        repeat_password: useRef<HTMLDivElement>(null)
    }

    const [registration, { data, error, isLoading }] = API.useAuthPostRegistrationMutation()

    const validationErrors = useMemo(
        () => (isApiValidationErrors<ApiType.Auth.PostRegistrationRequest>(error) ? error.messages : undefined),
        [error]
    )

    const focusFirstError = (errors: FieldErrors<FormDataType>) => {
        const field = FIELDS.find((name) => errors[name])
        if (field) {
            fieldRefs[field].current?.querySelector('input')?.focus()
        }
    }

    const submit = handleSubmit((values) => {
        void registration(values)
    }, focusFirstError)

    const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            void submit()
        }
    }

    useEffect(() => {
        FIELDS.forEach((field) => {
            const message = validationErrors?.[field as keyof ApiType.Auth.PostRegistrationRequest]
            if (message) {
                setError(field, { message, type: 'server' })
            }
        })
    }, [error])

    const errorMessages = FIELDS.map((field) => formErrors[field]?.message).filter(
        (message): message is string => !!message
    )

    const rules: Record<(typeof FIELDS)[number], React.ComponentProps<typeof Controller<FormDataType>>['rules']> = {
        email: {
            validate: (value) =>
                validateEmail(value) || t('error_email-incorrect', { defaultValue: 'Некорректный email' })
        },
        name: {
            validate: (value) => !!value?.trim() || t('error_name-required', { defaultValue: 'Имя обязательно' })
        },
        password: {
            minLength: {
                message: t('error_password-length', { defaultValue: 'Пароль должен быть не менее 8 символов' }),
                value: 8
            },
            required: t('error_password-required', { defaultValue: 'Пароль обязателен' })
        },
        repeat_password: {
            validate: (value) =>
                (!!value && value === getValues('password')) ||
                t('error_password-mismatch', { defaultValue: 'Пароли не совпадают' })
        }
    }

    const renderInput = (name: (typeof FIELDS)[number], props: React.ComponentProps<typeof Input>) => (
        <div
            className={styles.formElement}
            ref={fieldRefs[name]}
        >
            <Controller
                name={name}
                control={control}
                rules={rules[name]}
                render={({ field, fieldState }) => (
                    <Input
                        {...props}
                        name={field.name}
                        disabled={isLoading}
                        value={field.value}
                        error={fieldState.error?.message}
                        onKeyDown={handleKeyPress}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                    />
                )}
            />
        </div>
    )

    useEffect(() => {
        if (data?.auth) {
            dispatch(login(data))
            void router.push(`/users/${data.user?.id}`)
            dispatch(closeAuthDialog())
        }
    }, [data])

    return (
        <div className={styles.registrationForm}>
            {!!errorMessages.length && (
                <Message
                    type={'error'}
                    title={t('correct-errors-on-form', { defaultValue: 'Исправьте ошибки в форме' })}
                >
                    <ul className={'errorMessageList'}>
                        {errorMessages.map((item) => (
                            <li key={`item${item}`}>{item}</li>
                        ))}
                    </ul>
                </Message>
            )}

            {renderInput('name', {
                autoComplete: 'name',
                autoFocus: true,
                label: t('input_name', { defaultValue: 'Имя' }),
                tabIndex: 0
            })}

            {renderInput('email', {
                autoComplete: 'email',
                inputMode: 'email',
                label: t('input_email', { defaultValue: 'Email адрес' }),
                type: 'email'
            })}

            {renderInput('password', {
                autoComplete: 'new-password',
                label: t('input_password', { defaultValue: 'Пароль' }),
                type: 'password'
            })}

            {renderInput('repeat_password', {
                autoComplete: 'new-password',
                label: t('input_password-repeat', { defaultValue: 'Повторите пароль' }),
                type: 'password'
            })}

            <div className={styles.actions}>
                <Button
                    mode={'primary'}
                    label={t('register', { defaultValue: 'Зарегистрироваться' })}
                    disabled={isLoading}
                    onClick={() => void submit()}
                />

                <Button
                    mode={'secondary'}
                    label={t('cancel', { defaultValue: 'Отмена' })}
                    disabled={isLoading}
                    onClick={onClickLogin}
                />
            </div>
        </div>
    )
}
