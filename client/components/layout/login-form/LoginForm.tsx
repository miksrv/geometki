import React, { useEffect, useMemo, useRef } from 'react'
import { Controller, FieldErrors, useForm } from 'react-hook-form'
import { Button, Input, Message } from 'simple-react-ui-kit'

import Image from 'next/image'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiType } from '@/api'
import { closeAuthDialog } from '@/app/applicationSlice'
import { login } from '@/app/authSlice'
import { useAppDispatch } from '@/app/store'
import { LOCAL_STORAGE } from '@/config/constants'
import useLocalStorage from '@/hooks/useLocalStorage'
// Google login is hidden from the UI (RU legal requirement) but kept in code — see block below.
// import googleLogo from '@/public/images/google-logo.png'
import vkLogo from '@/public/images/vk-logo.png'
import yandexLogo from '@/public/images/yandex-logo.png'
import { isApiValidationErrors } from '@/utils/api'
import { validateEmail } from '@/utils/validators'

import styles from './styles.module.sass'

type LoginFormValues = Required<ApiType.Auth.PostLoginNativeRequest>

interface LoginFormProps {
    onClickRegistration?: () => void
    onSuccessLogin?: () => void
}

export const LoginForm: React.FC<LoginFormProps> = ({ onClickRegistration, onSuccessLogin }) => {
    const { t } = useTranslation('components.app-layout.login-form')
    const dispatch = useAppDispatch()
    const router = useRouter()

    const [, setReturnPath] = useLocalStorage<string>(LOCAL_STORAGE.RETURN_PATH)

    const {
        control,
        formState: { errors: formErrors },
        getValues,
        handleSubmit,
        setError,
        watch
    } = useForm<LoginFormValues>({ defaultValues: { email: '', password: '' } })

    const email = watch('email')

    // Input (simple-react-ui-kit) doesn't forward a ref to the underlying <input>, so the
    // wrapping element is used to find and focus it after a failed validation.
    const emailFieldRef = useRef<HTMLDivElement>(null)
    const passwordFieldRef = useRef<HTMLDivElement>(null)

    const [authLoginNative, { data: authData, isLoading: nativeLoading, isSuccess: nativeSuccess, error }] =
        API.useAuthPostLoginMutation()

    const [authLoginService, { data: serviceData, isLoading: serviceLoading, isSuccess: serviceSuccess }] =
        API.useAuthLoginServiceMutation()

    const [requestMagicLink, { data: magicLinkData, isLoading: magicLinkLoading, error: magicLinkError }] =
        API.useAuthRequestMagicLinkMutation()

    const magicLinkValidationErrors = useMemo(
        () =>
            isApiValidationErrors<ApiType.Auth.PostMagicLinkRequest>(magicLinkError)
                ? magicLinkError.messages
                : undefined,
        [magicLinkError]
    )

    const validationErrors = useMemo(
        () => (isApiValidationErrors<ApiType.Auth.PostRegistrationRequest>(error) ? error.messages : undefined),
        [error]
    )

    // Moves the focus to the first invalid field after a failed submit
    const focusFirstError = (errors: FieldErrors<LoginFormValues>) => {
        if (errors.email) {
            emailFieldRef.current?.querySelector('input')?.focus()
        } else if (errors.password) {
            passwordFieldRef.current?.querySelector('input')?.focus()
        }
    }

    const handleLoginButton = handleSubmit(async (values) => {
        await authLoginNative(values)
    }, focusFirstError)

    const handleLoginServiceButton = async (service: ApiType.AuthService) => {
        setReturnPath(router.asPath)
        await authLoginService({ service })
    }

    const handleMagicLinkButton = async () => {
        const email = getValues('email')

        if (!validateEmail(email) || !email) {
            setError('email', {
                message: t('error_email-incorrect', { defaultValue: 'Введенный email адрес не корректный' })
            })
            return
        }

        const isValidReturnPath = router.asPath.startsWith('/') && !router.asPath.includes('://')

        setReturnPath(router.asPath)

        await requestMagicLink({
            email,
            returnPath: isValidReturnPath ? router.asPath : undefined
        })
    }

    const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            void handleLoginButton()
        }
    }

    const loadingForm = nativeLoading || nativeSuccess || serviceLoading || serviceSuccess || magicLinkLoading

    useEffect(() => {
        if (validationErrors?.email) {
            setError('email', { message: validationErrors.email, type: 'server' })
        }
        if (validationErrors?.password) {
            setError('password', { message: validationErrors.password, type: 'server' })
        }
    }, [error])

    useEffect(() => {
        if (magicLinkValidationErrors?.email) {
            setError('email', { message: magicLinkValidationErrors.email, type: 'server' })
        }
    }, [magicLinkError])

    const errorMessages = [formErrors.email?.message, formErrors.password?.message].filter(
        (message): message is string => !!message
    )

    useEffect(() => {
        dispatch(login(authData))

        if (authData?.auth) {
            onSuccessLogin?.()
            dispatch(closeAuthDialog())
        }
    }, [authData])

    useEffect(() => {
        if (serviceData?.redirect && typeof window !== 'undefined') {
            window.location.href = serviceData.redirect
        }
    }, [serviceData?.redirect])

    if (magicLinkData?.sent) {
        return (
            <div className={styles.loginForm}>
                <Message type={'success'}>
                    {t('magic-link-sent', {
                        defaultValue: 'Письмо со ссылкой для входа отправлено на {{email}}. Проверьте почту.',
                        email
                    })}
                </Message>
            </div>
        )
    }

    return (
        <div className={styles.loginForm}>
            <div className={styles.loginServiceButtons}>
                <Button
                    mode={'outline'}
                    disabled={loadingForm}
                    aria-label={t('sign-in-with-vk', { defaultValue: 'Войти через VK' })}
                    tooltip={t('sign-in-with-vk', { defaultValue: 'Войти через VK' })}
                    onClick={() => handleLoginServiceButton('vk')}
                >
                    <Image
                        src={vkLogo.src}
                        width={40}
                        height={40}
                        alt={''}
                    />
                </Button>

                {/* Google login hidden from the UI (RU legal requirement). Code kept intact for a quick revert.
                <Button
                    mode={'outline'}
                    disabled={loadingForm}
                    onClick={() => handleLoginServiceButton('google')}
                >
                    <Image
                        src={googleLogo.src}
                        width={40}
                        height={40}
                        alt={''}
                    />
                </Button>
                */}

                <Button
                    mode={'outline'}
                    disabled={loadingForm}
                    aria-label={t('sign-in-with-yandex', { defaultValue: 'Войти через Яндекс' })}
                    tooltip={t('sign-in-with-yandex', { defaultValue: 'Войти через Яндекс' })}
                    onClick={() => handleLoginServiceButton('yandex')}
                >
                    <Image
                        src={yandexLogo.src}
                        width={40}
                        height={40}
                        alt={''}
                    />
                </Button>
            </div>

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

            <div
                className={styles.formElement}
                ref={emailFieldRef}
            >
                <Controller
                    name={'email'}
                    control={control}
                    rules={{
                        validate: (value) =>
                            validateEmail(value) ||
                            t('error_email-incorrect', { defaultValue: 'Введенный email адрес не корректный' })
                    }}
                    render={({ field, fieldState }) => (
                        <Input
                            tabIndex={0}
                            autoFocus={true}
                            label={t('input_email', { defaultValue: 'Email адрес' })}
                            name={field.name}
                            type={'email'}
                            autoComplete={'email'}
                            inputMode={'email'}
                            value={field.value}
                            error={fieldState.error?.message}
                            disabled={loadingForm}
                            onKeyDown={handleKeyPress}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                        />
                    )}
                />
            </div>

            <div
                className={styles.formElement}
                ref={passwordFieldRef}
            >
                <Controller
                    name={'password'}
                    control={control}
                    rules={{
                        required: t('error_password-required', { defaultValue: 'Пароль обязателен для входа' }),
                        minLength: {
                            message: t('error_password-length', {
                                defaultValue: 'Пароль должен быть не менее 8 символов'
                            }),
                            value: 8
                        }
                    }}
                    render={({ field, fieldState }) => (
                        <Input
                            label={t('input_password', { defaultValue: 'Пароль' })}
                            name={field.name}
                            type={'password'}
                            autoComplete={'current-password'}
                            value={field.value}
                            error={fieldState.error?.message}
                            disabled={loadingForm}
                            onKeyDown={handleKeyPress}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                        />
                    )}
                />
            </div>

            <div className={styles.formElement}>
                <Button
                    mode={'secondary'}
                    style={{ width: '100%' }}
                    loading={magicLinkLoading}
                    disabled={loadingForm || !validateEmail(email)}
                    onClick={handleMagicLinkButton}
                >
                    {t('sign-in-with-magic-link', { defaultValue: 'Войти по ссылке на email' })}
                </Button>
            </div>

            <div className={styles.actions}>
                <Button
                    mode={'link'}
                    title={t('registration', { defaultValue: 'Регистрация' })}
                    disabled={loadingForm}
                    onClick={onClickRegistration}
                >
                    {t('registration', { defaultValue: 'Регистрация' })}
                </Button>
                <Button
                    mode={'primary'}
                    loading={loadingForm}
                    disabled={loadingForm}
                    onClick={() => void handleLoginButton()}
                >
                    {t('sign-in', { defaultValue: 'Войти' })}
                </Button>
            </div>
        </div>
    )
}
