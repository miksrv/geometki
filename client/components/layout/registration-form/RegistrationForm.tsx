import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Input, Message } from 'simple-react-ui-kit'

import { useRouter } from 'next/dist/client/router'
import { useTranslation } from 'next-i18next'

import { API, ApiType } from '@/api'
import { closeAuthDialog } from '@/app/applicationSlice'
import { login } from '@/app/authSlice'
import { useAppDispatch } from '@/app/store'
import { isApiValidationErrors } from '@/utils/api'
import { validateEmail } from '@/utils/validators'

import styles from './styles.module.sass'

type FormDataType = ApiType.Auth.PostRegistrationRequest & {
    repeat_password?: string
}

interface RegistrationFormProps {
    onClickLogin?: () => void
}

export const RegistrationForm: React.FC<RegistrationFormProps> = ({ onClickLogin }) => {
    const { t } = useTranslation('components.app-bar.registration-form')
    const dispatch = useAppDispatch()
    const router = useRouter()

    const [formData, setFormData] = useState<FormDataType>()
    const [formErrors, setFormErrors] = useState<FormDataType>()

    const [registration, { data, error, isLoading }] = API.useAuthPostRegistrationMutation()

    const validationErrors = useMemo(
        () => (isApiValidationErrors<ApiType.Auth.PostRegistrationRequest>(error) ? error.messages : undefined),
        [error]
    )

    const validateForm = useCallback(() => {
        const errors: FormDataType = {}

        if (!formData?.name) {
            errors.name = t('error_name-required', { defaultValue: 'Имя обязательно' })
        }

        if (!validateEmail(formData?.email)) {
            errors.email = t('error_email-incorrect', { defaultValue: 'Некорректный email' })
        }

        if (!formData?.password) {
            errors.password = t('error_password-required', { defaultValue: 'Пароль обязателен' })
        }

        if (formData?.password && formData.password.length < 8) {
            errors.password = t('error_password-length', { defaultValue: 'Пароль должен быть не менее 8 символов' })
        }

        if (!formData?.repeat_password || formData.repeat_password !== formData.password) {
            errors.repeat_password = t('error_password-mismatch', { defaultValue: 'Пароли не совпадают' })
        }

        setFormErrors(errors)

        return !Object.keys(errors).length
    }, [formData])

    const handleChange = ({ target: { name, value } }: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [name]: value })
    }

    const handleSubmit = async () => {
        if (validateForm() && formData) {
            void registration(formData)
        }
    }

    const handleKeyPress = async (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            await handleSubmit()
        }
    }

    useEffect(() => {
        setFormErrors(validationErrors)
    }, [error])

    useEffect(() => {
        if (data?.auth) {
            dispatch(login(data))
            void router.push(`/users/${data.user?.id}`)
            dispatch(closeAuthDialog())
        }
    }, [data])

    return (
        <div className={styles.registrationForm}>
            {!!Object.values(formErrors || {}).length && (
                <Message
                    type={'error'}
                    title={t('correct-errors-on-form', { defaultValue: 'Исправьте ошибки в форме' })}
                >
                    <ul className={'errorMessageList'}>
                        {Object.values(formErrors || {}).map((item: string) =>
                            item.length ? <li key={`item${item}`}>{item}</li> : ''
                        )}
                    </ul>
                </Message>
            )}

            <div className={styles.formElement}>
                <Input
                    tabIndex={0}
                    autoFocus={true}
                    label={t('input_name', { defaultValue: 'Имя' })}
                    name={'name'}
                    disabled={isLoading}
                    value={formData?.name}
                    error={formErrors?.name}
                    onKeyDown={handleKeyPress}
                    onChange={handleChange}
                />
            </div>

            <div className={styles.formElement}>
                <Input
                    label={t('input_email', { defaultValue: 'Email адрес' })}
                    name={'email'}
                    disabled={isLoading}
                    value={formData?.email}
                    error={formErrors?.email}
                    onKeyDown={handleKeyPress}
                    onChange={handleChange}
                />
            </div>

            <div className={styles.formElement}>
                <Input
                    label={t('input_password', { defaultValue: 'Пароль' })}
                    name={'password'}
                    type={'password'}
                    disabled={isLoading}
                    value={formData?.password}
                    error={formErrors?.password}
                    onKeyDown={handleKeyPress}
                    onChange={handleChange}
                />
            </div>

            <div className={styles.formElement}>
                <Input
                    label={t('input_password-repeat', { defaultValue: 'Повторите пароль' })}
                    name={'repeat_password'}
                    type={'password'}
                    disabled={isLoading}
                    value={formData?.repeat_password}
                    error={formErrors?.repeat_password}
                    onKeyDown={handleKeyPress}
                    onChange={handleChange}
                />
            </div>

            <div className={styles.actions}>
                <Button
                    mode={'primary'}
                    label={t('register', { defaultValue: 'Зарегистрироваться' })}
                    disabled={isLoading}
                    onClick={handleSubmit}
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
