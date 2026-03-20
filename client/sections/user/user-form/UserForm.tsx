import React, { useCallback, useEffect, useState } from 'react'
import { Button, Checkbox, Input, Message } from 'simple-react-ui-kit'

import Image from 'next/image'
import { Trans, useTranslation } from 'next-i18next'

import { ApiModel, ApiType } from '@/api'
import { useAppSelector } from '@/api/store'
import { ScreenSpinner } from '@/components/ui'
import googleLogo from '@/public/images/google-logo.png'
import vkLogo from '@/public/images/vk-logo.png'
import yandexLogo from '@/public/images/yandex-logo.png'

import styles from './styles.module.sass'

interface UserFormProps {
    loading?: boolean
    values?: ApiModel.User
    errors?: ApiType.Users.PatchRequest
    onSubmit?: (formData?: ApiType.Users.PatchRequest) => void
    onCancel?: () => void
}

type FormDataType = ApiType.Users.PatchRequest & { confirmPassword?: string }

export const UserForm: React.FC<UserFormProps> = ({ loading, values, errors, onSubmit, onCancel }) => {
    const { t } = useTranslation()

    const userEmail = useAppSelector((state) => state.auth.user?.email)

    const [formErrors, setFormErrors] = useState<FormDataType>()
    const [formData, setFormData] = useState<FormDataType>(mapFormValues(values))

    const disabled =
        JSON.stringify(mapFormValues(values)?.settings) === JSON.stringify(formData.settings) &&
        values?.name === formData?.name &&
        values?.website === formData?.website &&
        !formData?.newPassword &&
        !formData?.oldPassword

    const handleChange = ({ target: { name, value } }: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [name]: value })
    }

    const handleChangeCheckbox = (event: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            settings: {
                ...formData?.settings,
                [event.target.id as ApiModel.UserSettingEnum]: event.target.checked
            }
        })
    }

    const validateForm = useCallback(() => {
        const errors: FormDataType = {}

        if (!formData.name) {
            errors.name = t('error_name-required')
        }

        if (formData.newPassword && !formData.oldPassword) {
            errors.oldPassword = t('error_old-password-required')
        }

        if (!formData.newPassword && formData.oldPassword) {
            errors.newPassword = t('error_new-password-required')
        }

        if (
            formData.oldPassword &&
            formData.newPassword &&
            formData.newPassword.length > 0 &&
            formData.newPassword !== formData.confirmPassword
        ) {
            errors.confirmPassword = t('error_password-mismatch')
        }

        if (formData.newPassword && formData.newPassword.length < 8) {
            errors.newPassword = t('error_password-length')
        }

        setFormErrors(errors)

        return !Object.keys(errors).length
    }, [formData])

    const handleSubmit = () => {
        if (validateForm() && !disabled) {
            onSubmit?.(formData)
        }
    }

    const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            handleSubmit()
        }
    }

    useEffect(() => {
        setFormData(mapFormValues(values))
    }, [values])

    useEffect(() => {
        setFormErrors(errors)
    }, [errors])

    return (
        <section className={styles.component}>
            {loading && <ScreenSpinner />}

            {!!Object.values(formErrors || {}).length && (
                <Message
                    type={'error'}
                    title={t('correct-errors-on-form')}
                >
                    <ul className={'errorMessageList'}>
                        {Object.values(formErrors || {}).map((item: string) =>
                            item.length ? <li key={`item${item}`}>{item}</li> : ''
                        )}
                    </ul>
                </Message>
            )}

            <h3 className={styles.header}>{t('general-settings')}</h3>
            <div className={styles.formElement}>
                <Input
                    tabIndex={0}
                    required={true}
                    autoFocus={true}
                    name={'name'}
                    label={t('input_name')}
                    placeholder={t('input_name-placeholder')}
                    disabled={loading}
                    value={formData.name}
                    error={formErrors?.name}
                    onKeyDown={handleKeyPress}
                    onChange={handleChange}
                />
            </div>

            <div className={styles.formElement}>
                <Input
                    label={t('input_email')}
                    disabled={true}
                    value={userEmail}
                />
            </div>

            <div className={styles.formElement}>
                <Input
                    name={'website'}
                    label={t('personal-page')}
                    placeholder={t('input_website-placeholder')}
                    disabled={loading}
                    value={formData.website}
                    error={formErrors?.website}
                    onKeyDown={handleKeyPress}
                    onChange={handleChange}
                />
            </div>

            <div className={styles.section}>
                <h3 className={styles.header}>{t('sending-notifications-by-email')}</h3>
                {['emailPhoto', 'emailRating', 'emailComment', 'emailEdit', 'emailCover'].map((setting) => (
                    <Checkbox
                        className={styles.settings}
                        key={setting}
                        id={setting}
                        label={t(`checkbox_${setting}`)}
                        disabled={loading}
                        onChange={handleChangeCheckbox}
                        checked={formData?.settings?.[setting as keyof ApiModel.UserSettings]}
                    />
                ))}
            </div>

            {!loading && !!values?.authType && (
                <div className={styles.section}>
                    <h3 className={styles.header}>{t('change-password')}</h3>
                    {values?.authType === 'native' ? (
                        <>
                            <div className={styles.formElement}>
                                <Input
                                    name={'oldPassword'}
                                    label={t('input_old-password')}
                                    type={'password'}
                                    placeholder={t('input_old-password-placeholder')}
                                    disabled={loading}
                                    value={formData?.oldPassword}
                                    error={formErrors?.oldPassword}
                                    onKeyDown={handleKeyPress}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className={styles.formElement}>
                                <Input
                                    name={'newPassword'}
                                    label={t('input_new-password')}
                                    type={'password'}
                                    placeholder={t('input_new-password-placeholder')}
                                    disabled={loading}
                                    value={formData?.newPassword}
                                    error={formErrors?.newPassword}
                                    onKeyDown={handleKeyPress}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className={styles.formElement}>
                                <Input
                                    name={'confirmPassword'}
                                    label={t('input_password-repeat')}
                                    type={'password'}
                                    disabled={loading}
                                    value={formData?.confirmPassword}
                                    error={formErrors?.confirmPassword}
                                    onKeyDown={handleKeyPress}
                                    onChange={handleChange}
                                />
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
                    disabled={loading || disabled}
                    onClick={handleSubmit}
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
    id: values?.id ?? '',
    name: values?.name ?? '',
    newPassword: '',
    oldPassword: '',
    settings: {
        emailComment: values?.settings?.emailComment ?? true,
        emailCover: values?.settings?.emailCover ?? true,
        emailEdit: values?.settings?.emailEdit ?? true,
        emailPhoto: values?.settings?.emailPhoto ?? true,
        emailPlace: values?.settings?.emailPlace ?? true,
        emailRating: values?.settings?.emailRating ?? true
    },
    website: values?.website
})
