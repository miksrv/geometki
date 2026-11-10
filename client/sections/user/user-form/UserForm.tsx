import React, { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { IconTypes, Input, Message, Skeleton } from 'simple-react-ui-kit'

import Image from 'next/image'
import { Trans, useTranslation } from 'next-i18next/pages'

import { ApiModel, ApiType } from '@/api'
import { useAppSelector } from '@/app/store'
import { Chip, FormActions, FormSection, FormSections } from '@/components/ui'
import googleLogo from '@/public/images/google-logo.png'
import vkLogo from '@/public/images/vk-logo.png'
import yandexLogo from '@/public/images/yandex-logo.png'
import { scrollToFirstError } from '@/utils/scrollToFirstError'
import { USER_NAME_ERROR_KEYS, USER_NAME_MAX, USER_NAME_MIN, validateUserName } from '@/utils/userName'

import { PushDeviceSettings } from '../push-device-settings'

import styles from './styles.module.sass'

interface UserFormProps {
    loading?: boolean
    values?: ApiModel.User
    errors?: ApiType.Users.PatchRequest
    /** A save that failed on the server, over the sections */
    serverError?: string
    onSubmit?: (formData?: ApiType.Users.PatchRequest) => void
    onCancel?: () => void
    /** Reports whether the form holds changes that would be lost on leaving */
    onDirtyChange?: (isDirty: boolean) => void
}

type FormDataType = ApiType.Users.PatchRequest & { confirmPassword?: string }

const TEXT_FIELDS = ['name', 'website', 'oldPassword', 'newPassword', 'confirmPassword'] as const

const SETTINGS = ApiModel.userSettingKeys()

/** The events on the user's places first, then the user's own progress and the digest */
const PLACE_NOTIFICATIONS: readonly ApiModel.NotificationType[] = [
    'comment',
    'photo',
    'rating',
    'edit',
    'cover',
    'bookmark',
    'visit'
]

const NOTIFICATION_GROUPS = [
    { key: 'places', types: PLACE_NOTIFICATIONS },
    { key: 'other', types: ApiModel.NotificationTypes.filter((type) => !PLACE_NOTIFICATIONS.includes(type)) }
] as const

type SettingsSectionKey = 'profile' | 'notifications' | 'security'

/** The parts of the settings: the anchors of the side menu and the ids of the cards */
const SECTIONS: Array<{ key: SettingsSectionKey; icon: IconTypes }> = [
    { icon: 'User', key: 'profile' },
    { icon: 'Bell', key: 'notifications' },
    { icon: 'Lock', key: 'security' }
]

const AUTH_SERVICE_LOGOS: Record<string, string> = {
    google: googleLogo.src,
    vk: vkLogo.src,
    yandex: yandexLogo.src
}

/**
 * The settings form (`/users/settings`, DESIGN.md → Settings): a sticky menu of the parts on the
 * left — "Профиль", "Уведомления", "Вход и пароль" — scrolling to their cards on the right, then
 * Cancel and Save, kept at the bottom of the screen while there are changes.
 */
export const UserForm: React.FC<UserFormProps> = ({
    loading,
    values,
    errors,
    serverError,
    onSubmit,
    onCancel,
    onDirtyChange
}) => {
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

    const submit = handleSubmit(
        (data) => {
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
        },
        (invalid) => scrollToFirstError(invalid)
    )

    const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            void submit()
        }
    }

    // A refetch of the profile must not wipe what the user is typing
    useEffect(() => {
        reset(mapFormValues(values), { keepDirtyValues: true })
    }, [values])

    // The API's errors go on their fields, and the first of them is brought into view, as a
    // failed check of the form is
    useEffect(() => {
        const serverErrors = TEXT_FIELDS.filter((field) => {
            const message = errors?.[field as keyof ApiType.Users.PatchRequest]
            if (typeof message === 'string' && message) {
                setError(field, { message, type: 'server' })
                return true
            }
            return false
        })

        if (serverErrors.length) {
            scrollToFirstError(Object.fromEntries(serverErrors.map((field) => [field, { type: 'server' }])))
        }
    }, [errors])

    useEffect(() => {
        onDirtyChange?.(isDirty)
    }, [isDirty])

    const sections = SECTIONS.filter(({ key }) => key !== 'security' || !values || !!values.authType).map(
        ({ key, icon }) => ({ icon, key, title: t(`settings-section-${key}`) })
    )

    if (!values?.id) {
        return (
            <FormSections
                sections={sections}
                label={t('settings-sections')}
            >
                <UserFormLoader />
            </FormSections>
        )
    }

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
                    size={'medium'}
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

    const isNative = values.authType === 'native'

    // A name saved before the rule stays as it is until its owner changes it
    const validateName = (value?: string) => {
        if (!value?.trim()) {
            return t('error_name-required')
        }

        const nameError = value === values.name ? undefined : validateUserName(value)

        return !nameError || t(USER_NAME_ERROR_KEYS[nameError], { max: USER_NAME_MAX, min: USER_NAME_MIN })
    }

    return (
        <FormSections
            sections={sections}
            label={t('settings-sections')}
        >
            {serverError && <Message type={'error'}>{serverError}</Message>}

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

            <FormSection
                id={'profile'}
                title={t('settings-section-profile')}
                description={t('settings-section-profile-description')}
            >
                <div className={styles.fields}>
                    {renderTextInput(
                        'name',
                        {
                            autoFocus: true,
                            label: t('input_name'),
                            maxLength: USER_NAME_MAX,
                            placeholder: t('input_name-placeholder'),
                            required: true
                        },
                        { validate: validateName }
                    )}

                    {renderTextInput('website', {
                        label: t('personal-page'),
                        placeholder: t('input_website-placeholder')
                    })}

                    <div className={styles.wide}>
                        <Input
                            size={'medium'}
                            label={t('input_email')}
                            disabled={true}
                            value={userEmail ?? ''}
                        />
                        <p className={styles.hint}>{t('settings-email-hint')}</p>
                    </div>
                </div>
            </FormSection>

            <FormSection
                id={'notifications'}
                title={t('settings-section-notifications')}
                description={t('settings-section-notifications-description')}
            >
                <PushDeviceSettings />

                {NOTIFICATION_GROUPS.map((group) => (
                    <div
                        key={group.key}
                        className={styles.notificationGroup}
                        role={'group'}
                        aria-labelledby={`notifications-${group.key}`}
                    >
                        <div
                            id={`notifications-${group.key}`}
                            className={styles.groupLabel}
                        >
                            {t(`notification-group_${group.key}`)}
                        </div>

                        <ul className={styles.notificationList}>
                            {group.types.map((type) => (
                                <li
                                    key={type}
                                    className={styles.notificationRow}
                                >
                                    <span className={styles.notificationTitle}>{t(`notification-type_${type}`)}</span>

                                    <span className={styles.channels}>
                                        {ApiModel.NotificationChannels.map((channel) => (
                                            <span
                                                key={channel}
                                                className={styles.channel}
                                            >
                                                {ApiModel.NotificationChannelTypes[channel].includes(type) && (
                                                    <Controller
                                                        name={`settings.${ApiModel.userSettingKey(channel, type)}`}
                                                        control={control}
                                                        render={({ field }) => (
                                                            <Chip
                                                                size={'small'}
                                                                label={t(`notification-channel_${channel}`)}
                                                                aria-label={`${t(`notification-channel_${channel}`)}: ${t(`notification-type_${type}`)}`}
                                                                selected={!!field.value}
                                                                disabled={loading}
                                                                className={styles.channelChip}
                                                                onClick={() => field.onChange(!field.value)}
                                                            />
                                                        )}
                                                    />
                                                )}
                                            </span>
                                        ))}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}

                <p className={styles.hint}>{t('email-notifications-hint')}</p>
                <p className={styles.hint}>{t('push-column-hint')}</p>
            </FormSection>

            {!!values.authType && (
                <FormSection
                    id={'security'}
                    title={t('settings-section-security')}
                >
                    {isNative ? (
                        <div className={styles.fields}>
                            <div className={styles.wide}>
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
                    ) : (
                        <div className={styles.authService}>
                            <Image
                                src={AUTH_SERVICE_LOGOS[values.authType] ?? yandexLogo.src}
                                width={32}
                                height={32}
                                alt={''}
                            />
                            <p>
                                <Trans
                                    i18nKey={'you-logged-via-service'}
                                    values={{ service: values.authType }}
                                />
                            </p>
                        </div>
                    )}
                </FormSection>
            )}

            <FormActions
                dirty={isDirty}
                loading={loading}
                onSave={() => void submit()}
                onCancel={onCancel}
            />
        </FormSections>
    )
}

/** The cards' shape while the profile loads */
const UserFormLoader: React.FC = () => (
    <div
        className={styles.loader}
        aria-busy={true}
    >
        {[3, 6, 2].map((rows, index) => (
            <FormSection key={index}>
                <div className={styles.loaderRows}>
                    <Skeleton className={styles.loaderTitle} />
                    {Array.from({ length: rows }, (_, row) => (
                        <Skeleton
                            key={row}
                            className={styles.loaderRow}
                        />
                    ))}
                </div>
            </FormSection>
        ))}
    </div>
)

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
