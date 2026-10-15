import React, { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Button, Checkbox, Input, Message } from 'simple-react-ui-kit'

import Image from 'next/image'
import { Trans, useTranslation } from 'next-i18next/pages'

import { ApiModel, ApiType } from '@/api'
import { useAppSelector } from '@/app/store'
import { ScreenSpinner } from '@/components/ui'
import googleLogo from '@/public/images/google-logo.png'
import vkLogo from '@/public/images/vk-logo.png'
import yandexLogo from '@/public/images/yandex-logo.png'

import { PushDeviceSettings } from '../push-device-settings'

import styles from './styles.module.sass'

interface UserFormProps {
    loading?: boolean
    values?: ApiModel.User
    errors?: ApiType.Users.PatchRequest
    onSubmit?: (formData?: ApiType.Users.PatchRequest) => void
    onCancel?: () => void
    /** Reports whether the form holds changes that would be lost on leaving */
    onDirtyChange?: (isDirty: boolean) => void
}

type FormDataType = ApiType.Users.PatchRequest & { confirmPassword?: string }

const TEXT_FIELDS = ['name', 'website', 'oldPassword', 'newPassword', 'confirmPassword'] as const

const SETTINGS = ApiModel.userSettingKeys()

export const UserForm: React.FC<UserFormProps> = ({ loading, values, errors, onSubmit, onCancel, onDirtyChange }) => {
    const { t } = useTranslation()

    const userEmail = useAppSelector((state) => state.auth.user?.email)

    const {
        control,
        formState: { dirtyFields, errors: formErrors, isDirty },
        getValues,
        handleSubmit,
        reset,
        setError
    } = useForm<FormDataType>({ defaultValues: mapFormValues(values) })

    const submit = handleSubmit((data) => {
        if (isDirty) {
            // Only the switches the user changed: an untouched one must not overwrite a change
            // made elsewhere meanwhile (an unsubscribe link opened in another tab)
            const changed = SETTINGS.filter((key) => dirtyFields.settings?.[key])

            onSubmit?.({
                ...data,
                settings: changed.length
                    ? Object.fromEntries(changed.map((key) => [key, data.settings?.[key]]))
                    : undefined
            })
        }
    })

    const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            void submit()
        }
    }

    // A refetch of the profile must not wipe what the user is typing
    useEffect(() => {
        reset(mapFormValues(values), { keepDirtyValues: true })
    }, [values])

    useEffect(() => {
        TEXT_FIELDS.forEach((field) => {
            const message = errors?.[field as keyof ApiType.Users.PatchRequest]
            if (typeof message === 'string' && message) {
                setError(field, { message, type: 'server' })
            }
        })
    }, [errors])

    useEffect(() => {
        onDirtyChange?.(isDirty)
    }, [isDirty])

    const errorMessages = TEXT_FIELDS.map((field) => formErrors[field]?.message).filter(
        (message): message is string => !!message
    )

    const renderTextInput = (
        name: (typeof TEXT_FIELDS)[number],
        props: React.ComponentProps<typeof Input>,
        rules?: React.ComponentProps<typeof Controller<FormDataType, typeof name>>['rules']
    ) => (
        <Controller
            name={name}
            control={control}
            rules={rules}
            render={({ field, fieldState }) => (
                <Input
                    {...props}
                    name={field.name}
                    disabled={props.disabled ?? loading}
                    value={field.value ?? ''}
                    error={fieldState.error?.message}
                    onKeyDown={handleKeyPress}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                />
            )}
        />
    )

    return (
        <section className={styles.component}>
            {loading && <ScreenSpinner />}

            {!!errorMessages.length && (
                <Message
                    type={'error'}
                    title={t('correct-errors-on-form')}
                >
                    <ul className={'errorMessageList'}>
                        {errorMessages.map((item) => (
                            <li key={`item${item}`}>{item}</li>
                        ))}
                    </ul>
                </Message>
            )}

            <h3 className={styles.header}>{t('general-settings')}</h3>
            <div className={styles.formElement}>
                {renderTextInput(
                    'name',
                    {
                        autoFocus: true,
                        label: t('input_name'),
                        placeholder: t('input_name-placeholder'),
                        required: true,
                        tabIndex: 0
                    },
                    { validate: (value) => !!value?.trim() || t('error_name-required') }
                )}
            </div>

            <div className={styles.formElement}>
                <Input
                    label={t('input_email')}
                    disabled={true}
                    value={userEmail ?? ''}
                />
            </div>

            <div className={styles.formElement}>
                {renderTextInput('website', {
                    label: t('personal-page'),
                    placeholder: t('input_website-placeholder')
                })}
            </div>

            <div className={styles.section}>
                <h3 className={styles.header}>{t('notifications-settings')}</h3>

                <PushDeviceSettings />

                <table className={styles.notifications}>
                    <thead>
                        <tr>
                            <th scope={'col'}>{t('notifications-settings-type')}</th>
                            {ApiModel.NotificationChannels.map((channel) => (
                                <th
                                    key={channel}
                                    scope={'col'}
                                >
                                    {t(`notification-channel_${channel}`)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {ApiModel.NotificationTypes.map((type) => (
                            <tr key={type}>
                                <th scope={'row'}>{t(`notification-type_${type}`)}</th>
                                {ApiModel.NotificationChannels.map((channel) => (
                                    <td key={channel}>
                                        {ApiModel.NotificationChannelTypes[channel].includes(type) ? (
                                            <Controller
                                                name={`settings.${ApiModel.userSettingKey(channel, type)}`}
                                                control={control}
                                                render={({ field }) => (
                                                    <Checkbox
                                                        id={ApiModel.userSettingKey(channel, type)}
                                                        className={styles.channelCheckbox}
                                                        aria-label={`${t(`notification-channel_${channel}`)}: ${t(`notification-type_${type}`)}`}
                                                        disabled={loading}
                                                        checked={!!field.value}
                                                        onChange={(event) => field.onChange(event.target.checked)}
                                                    />
                                                )}
                                            />
                                        ) : (
                                            <span
                                                className={styles.notApplicable}
                                                aria-hidden={true}
                                            >
                                                —
                                            </span>
                                        )}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>

                <p className={styles.hint}>{t('email-notifications-hint')}</p>
                <p className={styles.hint}>{t('push-column-hint')}</p>
            </div>

            {!loading && !!values?.authType && (
                <div className={styles.section}>
                    <h3 className={styles.header}>{t('change-password')}</h3>
                    {values?.authType === 'native' ? (
                        <>
                            <div className={styles.formElement}>
                                {renderTextInput(
                                    'oldPassword',
                                    {
                                        label: t('input_old-password'),
                                        placeholder: t('input_old-password-placeholder'),
                                        type: 'password'
                                    },
                                    {
                                        validate: (value) =>
                                            !getValues('newPassword') || !!value || t('error_old-password-required')
                                    }
                                )}
                            </div>

                            <div className={styles.formElement}>
                                {renderTextInput(
                                    'newPassword',
                                    {
                                        label: t('input_new-password'),
                                        placeholder: t('input_new-password-placeholder'),
                                        type: 'password'
                                    },
                                    {
                                        validate: (value) => {
                                            if (!value) {
                                                return !getValues('oldPassword') || t('error_new-password-required')
                                            }
                                            return value.length >= 8 || t('error_password-length')
                                        }
                                    }
                                )}
                            </div>

                            <div className={styles.formElement}>
                                {renderTextInput(
                                    'confirmPassword',
                                    {
                                        label: t('input_password-repeat'),
                                        type: 'password'
                                    },
                                    {
                                        validate: (value) =>
                                            !getValues('newPassword') ||
                                            value === getValues('newPassword') ||
                                            t('error_password-mismatch')
                                    }
                                )}
                            </div>
                        </>
                    ) : (
                        <div className={styles.authService}>
                            <Image
                                src={
                                    values?.authType === 'google'
                                        ? googleLogo.src
                                        : values?.authType === 'vk'
                                          ? vkLogo.src
                                          : yandexLogo.src
                                }
                                width={48}
                                height={48}
                                alt={''}
                            />
                            <p>
                                <Trans
                                    i18nKey={'you-logged-via-service'}
                                    values={{ service: values?.authType }}
                                />
                            </p>
                        </div>
                    )}
                </div>
            )}

            <div className={styles.actions}>
                <Button
                    size={'medium'}
                    mode={'primary'}
                    loading={loading}
                    label={t('save')}
                    disabled={loading || !isDirty}
                    onClick={() => void submit()}
                />

                <Button
                    size={'medium'}
                    mode={'secondary'}
                    label={t('cancel')}
                    disabled={loading}
                    onClick={onCancel}
                />
            </div>
        </section>
    )
}

const mapFormValues = (values?: FormDataType): FormDataType => ({
    confirmPassword: '',
    id: values?.id ?? '',
    name: values?.name ?? '',
    newPassword: '',
    oldPassword: '',
    // A missing key means the notification is on
    settings: Object.fromEntries(SETTINGS.map((key) => [key, values?.settings?.[key] ?? true])),
    website: values?.website ?? ''
})
