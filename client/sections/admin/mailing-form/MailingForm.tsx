import React, { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Button, Container, Input, Message, Skeleton, TextArea } from 'simple-react-ui-kit'

import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiType } from '@/api'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch } from '@/app/store'
import { ConfirmationDialog, MAILING_STATUS_TONES, StatusBadge } from '@/components/shared'
import { FieldHint, FormActions, FormSection, HintedField, StatTiles } from '@/components/ui'
import { IMG_HOST } from '@/config/env'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import { ADMIN_MAILINGS_HREF } from '@/utils/admin'
import { applyServerErrors, parseServerErrors } from '@/utils/formErrors'
import { formatThousands } from '@/utils/helpers'
import { formatMailingDate, isMailingDraft, isMailingUrl } from '@/utils/mailings'
import { scrollToFirstError } from '@/utils/scrollToFirstError'

import { MailingImage } from './MailingImage'
import { MailingFormMode } from './MailingModeSwitch'
import { MailingPreview } from './MailingPreview'

import styles from './styles.module.sass'

type MailingValues = Required<ApiType.Mailings.MailingInput>

const SUBJECT_MAX = 200
const CONTENT_MAX = 20000
const LABEL_MAX = 60
const URL_MAX = 500

const FIELDS = ['subject', 'content', 'button_label', 'button_url'] as const

interface MailingFormProps {
    /** The mailing to edit (`GET mailings/manage/:id`); a new one without it */
    mailing?: ApiType.Mailings.MailingAdmin
    /** The mailing is still loading: the form stands in its place with every field and button off */
    loading?: boolean
    /** The fields of the letter or its preview: switched by `MailingModeSwitch` on the title line */
    mode?: MailingFormMode
}

const toValues = (mailing?: ApiType.Mailings.MailingAdmin): MailingValues => ({
    button_label: mailing?.button_label ?? '',
    button_url: mailing?.button_url ?? '',
    content: mailing?.content ?? '',
    subject: mailing?.subject ?? ''
})

/**
 * The form of a mailing (DESIGN.md → Admin): the texts (in Russian only), the button, the picture
 * (after the first save) and, beside them, the live preview of the real letter. Only a draft is
 * edited: sent or canceled, the mailing is shown with its delivery numbers. A saved draft can be
 * tested (a letter to the administrator's own address) and sent to the users after a confirmation
 * that says how many there will be; one that is sending can be canceled.
 */
export const MailingForm: React.FC<MailingFormProps> = ({ mailing, loading, mode = 'edit' }) => {
    const { t } = useTranslation()
    const router = useRouter()
    const dispatch = useAppDispatch()

    const isCreate = !mailing && !loading
    const editable = isCreate || isMailingDraft(mailing)

    const [createMailing, { isLoading: creating }] = API.useMailingsPostMutation()
    const [updateMailing, { isLoading: updating }] = API.useMailingsPatchMutation()
    const [deleteMailing, { isLoading: deleting }] = API.useMailingsDeleteMutation()
    const [uploadImage] = API.useMailingsPostImageMutation()
    const [removeImage] = API.useMailingsDeleteImageMutation()
    const [sendTest, { isLoading: testing }] = API.useMailingsPostTestMutation()
    const [sendMailing, { isLoading: sending }] = API.useMailingsPostSendMutation()
    const [cancelMailing, { isLoading: canceling }] = API.useMailingsPostCancelMutation()

    const {
        control,
        formState: { isDirty },
        handleSubmit,
        reset,
        setError,
        watch
    } = useForm<MailingValues>({ defaultValues: toValues(mailing) })

    const [serverError, setServerError] = useState<string>()
    const [deleteOpen, setDeleteOpen] = useState<boolean>(false)
    const [sendOpen, setSendOpen] = useState<boolean>(false)
    const [cancelOpen, setCancelOpen] = useState<boolean>(false)
    // A new mailing has no id to upload to yet: its picture waits and goes up right after the first save
    const [pendingImage, setPendingImage] = useState<File>()
    const [pendingImageUrl, setPendingImageUrl] = useState<string>()

    useEffect(() => {
        if (!pendingImage) {
            setPendingImageUrl(undefined)
            return
        }

        const url = URL.createObjectURL(pendingImage)
        setPendingImageUrl(url)

        return () => URL.revokeObjectURL(url)
    }, [pendingImage])

    const watched = watch()
    // `watch()` is a new object every render: the preview gets a new one only when a text changed,
    // or every re-render (the poll of a mailing being sent) would draw the letter again
    const { button_label, button_url, content, subject } = watched
    const values = useMemo(
        () => ({ button_label, button_url, content, subject }),
        [button_label, button_url, content, subject]
    )
    const saving = creating || updating
    const busy = saving || deleting || sending || canceling || !!loading
    const { allowNavigation, confirmDiscard, dialogProps } = useUnsavedChangesGuard(isDirty)

    // The count of the people the letter goes to is asked for the confirmation only
    const audience = API.useMailingsGetAudienceQuery(undefined, { skip: !sendOpen })

    const notify = (id: string, message: string, type: 'error' | 'success' = 'success') =>
        void dispatch(Notify({ id, message, title: '', type }))

    const fail = (error: unknown) => {
        const { fields, message } = parseServerErrors(error, FIELDS)

        applyServerErrors(setError, fields)
        setServerError(message ?? (Object.keys(fields).length ? undefined : t('error')))
    }

    const onSubmit = async (input: MailingValues) => {
        setServerError(undefined)

        try {
            const saved = mailing
                ? await updateMailing({ body: input, id: mailing.id }).unwrap()
                : await createMailing(input).unwrap()

            notify('adminSaved', t('admin-saved'))

            if (isCreate && pendingImage) {
                // The texts are saved whatever happens to the picture: a refused one can be added again
                await handleUpload(pendingImage, saved.id).catch((error: unknown) =>
                    notify('mailingImage', parseServerErrors(error, []).message ?? t('error'), 'error')
                )
            }

            if (isCreate) {
                allowNavigation()
                // The picture and the sending are on the mailing's own page
                await router.push(`${ADMIN_MAILINGS_HREF}/${saved.id}`)
            } else {
                reset(toValues(saved))
            }
        } catch (error) {
            fail(error)
        }
    }

    const handleDelete = async () => {
        if (!mailing) {
            return
        }

        setDeleteOpen(false)

        try {
            await deleteMailing(mailing.id).unwrap()
            notify('adminSaved', t('admin-deleted'))
            allowNavigation()
            await router.push(ADMIN_MAILINGS_HREF)
        } catch (error) {
            fail(error)
        }
    }

    const handleTest = async () => {
        if (!mailing) {
            return
        }

        try {
            const { email } = await sendTest(mailing.id).unwrap()

            notify('mailingTest', t('admin-mailing-test-sent', { email }))
        } catch (error) {
            notify('mailingTest', parseServerErrors(error, []).message ?? t('error'), 'error')
        }
    }

    const handleSend = async () => {
        if (!mailing) {
            return
        }

        setSendOpen(false)

        try {
            await sendMailing(mailing.id).unwrap()
            notify('mailingSend', t('admin-mailing-sent'))
        } catch (error) {
            notify('mailingSend', parseServerErrors(error, []).message ?? t('error'), 'error')
        }
    }

    const handleCancel = async () => {
        if (!mailing) {
            return
        }

        setCancelOpen(false)

        try {
            await cancelMailing(mailing.id).unwrap()
            notify('mailingCancel', t('admin-mailing-canceled'))
        } catch (error) {
            notify('mailingCancel', parseServerErrors(error, []).message ?? t('error'), 'error')
        }
    }

    // The server says why a picture is refused in `messages.image`; the slot shows `messages.error`
    const handleUpload = (file: File, id: string) =>
        uploadImage({ file, id })
            .unwrap()
            .catch((error: unknown) => {
                const { fields } = parseServerErrors(error, ['image'])

                throw fields.image ? { messages: { error: fields.image } } : error
            })

    const imageSrc = mailing?.image ? `${IMG_HOST?.replace(/\/$/, '')}/${mailing.image.replace(/^\//, '')}` : undefined
    const audienceTotal = audience.data?.total

    const deliveryTiles = (item: ApiType.Mailings.MailingAdmin): React.ComponentProps<typeof StatTiles>['items'] => [
        { key: 'recipients', label: t('admin-mailing-recipients'), value: formatThousands(item.recipients) },
        { key: 'sent', label: t('admin-mailing-delivery-sent'), value: formatThousands(item.delivery.sent) },
        { key: 'pending', label: t('admin-mailing-delivery-pending'), value: formatThousands(item.delivery.pending) },
        { key: 'failed', label: t('admin-mailing-delivery-failed'), value: formatThousands(item.delivery.failed) },
        {
            key: 'rejected',
            label: t('admin-mailing-delivery-rejected'),
            value: formatThousands(item.delivery.rejected)
        }
    ]

    const sendMessage =
        audienceTotal === undefined
            ? t('admin-mailing-send-counting')
            : audienceTotal === 0
              ? t('admin-mailing-send-nobody')
              : t('admin-mailing-send-confirm', { total: formatThousands(audienceTotal) })

    const statusSection = mailing && !isMailingDraft(mailing) && (
        <FormSection
            id={'delivery'}
            title={t('admin-mailing-section-delivery')}
        >
            <div className={styles.status}>
                <StatusBadge
                    label={t(`admin-mailing-status-${mailing.status}`)}
                    tone={MAILING_STATUS_TONES[mailing.status]}
                    size={'medium'}
                />
                {mailing.sent_at && (
                    <span className={styles.statusDate}>
                        {t('admin-mailing-sent-at', { date: formatMailingDate(mailing.sent_at) })}
                    </span>
                )}
                {mailing.completed_at && (
                    <span className={styles.statusDate}>
                        {t('admin-mailing-completed-at', { date: formatMailingDate(mailing.completed_at) })}
                    </span>
                )}
            </div>

            <StatTiles
                aria-label={t('admin-mailing-section-delivery')}
                items={deliveryTiles(mailing)}
            />

            {mailing.status === 'sending' && (
                <div className={styles.row}>
                    <Button
                        mode={'secondary'}
                        variant={'negative'}
                        size={'medium'}
                        label={t('admin-mailing-cancel-sending')}
                        loading={canceling}
                        disabled={busy}
                        onClick={() => setCancelOpen(true)}
                    />
                    <FieldHint>{t('admin-mailing-cancel-sending-hint')}</FieldHint>
                </div>
            )}
        </FormSection>
    )

    const sendSection = mailing && isMailingDraft(mailing) && (
        <FormSection
            id={'send'}
            title={t('admin-mailing-section-send')}
        >
            <div className={styles.row}>
                <Button
                    mode={'secondary'}
                    size={'medium'}
                    label={t('admin-mailing-test')}
                    loading={testing}
                    disabled={busy || testing || isDirty}
                    onClick={() => void handleTest()}
                />
                <Button
                    mode={'primary'}
                    size={'medium'}
                    label={t('admin-mailing-send')}
                    loading={sending}
                    disabled={busy || isDirty}
                    onClick={() => setSendOpen(true)}
                />
            </div>

            <FieldHint>{isDirty ? t('admin-mailing-send-unsaved') : t('admin-mailing-test-hint')}</FieldHint>
        </FormSection>
    )

    return (
        <div className={styles.layout}>
            <div className={styles.form}>
                {serverError && <Message type={'error'}>{serverError}</Message>}

                {statusSection}

                {mode === 'preview' &&
                    (loading ? (
                        <Container>
                            <Skeleton style={{ height: 480, width: '100%' }} />
                        </Container>
                    ) : (
                        <MailingPreview
                            values={values}
                            mailingId={mailing?.id}
                        />
                    ))}

                {mode === 'edit' && (
                    <>
                        <FormSection
                            id={'texts'}
                            title={t('admin-mailing-section-texts')}
                        >
                            <div className={styles.fields}>
                                <Controller
                                    name={'subject'}
                                    control={control}
                                    rules={{
                                        maxLength: {
                                            message: t('admin-field-too-long', { max: SUBJECT_MAX }),
                                            value: SUBJECT_MAX
                                        },
                                        validate: (value) => !!value.trim() || t('admin-field-required')
                                    }}
                                    render={({ field, fieldState }) => (
                                        <Input
                                            size={'medium'}
                                            name={field.name}
                                            label={t('admin-mailing-subject')}
                                            required={true}
                                            maxLength={SUBJECT_MAX}
                                            disabled={busy || !editable}
                                            autoFocus={isCreate}
                                            value={field.value}
                                            error={fieldState.error?.message}
                                            onChange={field.onChange}
                                            onBlur={field.onBlur}
                                        />
                                    )}
                                />

                                <Controller
                                    name={'content'}
                                    control={control}
                                    rules={{
                                        maxLength: {
                                            message: t('admin-field-too-long', { max: CONTENT_MAX }),
                                            value: CONTENT_MAX
                                        },
                                        validate: (value) => !!value.trim() || t('admin-field-required')
                                    }}
                                    render={({ field, fieldState }) => (
                                        <HintedField
                                            id={'mailing-content'}
                                            hint={t('admin-mailing-content-hint')}
                                        >
                                            {(describedBy) => (
                                                <TextArea
                                                    name={field.name}
                                                    label={t('admin-mailing-content')}
                                                    required={true}
                                                    rows={14}
                                                    maxLength={CONTENT_MAX}
                                                    disabled={busy || !editable}
                                                    aria-describedby={describedBy}
                                                    value={field.value}
                                                    error={fieldState.error?.message}
                                                    onChange={field.onChange}
                                                    onBlur={field.onBlur}
                                                />
                                            )}
                                        </HintedField>
                                    )}
                                />
                            </div>
                        </FormSection>

                        <FormSection
                            id={'button'}
                            title={t('admin-mailing-section-button')}
                        >
                            <div className={styles.fields}>
                                <Controller
                                    name={'button_url'}
                                    control={control}
                                    rules={{
                                        maxLength: {
                                            message: t('admin-field-too-long', { max: URL_MAX }),
                                            value: URL_MAX
                                        },
                                        validate: (value) =>
                                            !value.trim() ||
                                            isMailingUrl(value.trim()) ||
                                            t('admin-mailing-button-url-invalid')
                                    }}
                                    render={({ field, fieldState }) => (
                                        <HintedField
                                            id={'mailing-button-url'}
                                            hint={t('admin-mailing-button-url-hint')}
                                        >
                                            {(describedBy) => (
                                                <Input
                                                    size={'medium'}
                                                    name={field.name}
                                                    label={t('admin-mailing-button-url')}
                                                    placeholder={'/game'}
                                                    maxLength={URL_MAX}
                                                    disabled={busy || !editable}
                                                    aria-describedby={describedBy}
                                                    value={field.value}
                                                    error={fieldState.error?.message}
                                                    onChange={field.onChange}
                                                    onBlur={field.onBlur}
                                                />
                                            )}
                                        </HintedField>
                                    )}
                                />

                                <Controller
                                    name={'button_label'}
                                    control={control}
                                    rules={{
                                        maxLength: {
                                            message: t('admin-field-too-long', { max: LABEL_MAX }),
                                            value: LABEL_MAX
                                        },
                                        validate: (value, form) =>
                                            !!value.trim() || !form.button_url.trim() || t('admin-field-required')
                                    }}
                                    render={({ field, fieldState }) => (
                                        <Input
                                            size={'medium'}
                                            name={field.name}
                                            label={t('admin-mailing-button-label')}
                                            maxLength={LABEL_MAX}
                                            disabled={busy || !editable}
                                            value={field.value}
                                            error={fieldState.error?.message}
                                            onChange={field.onChange}
                                            onBlur={field.onBlur}
                                        />
                                    )}
                                />
                            </div>
                        </FormSection>

                        <FormSection
                            id={'image'}
                            title={t('admin-mailing-section-image')}
                        >
                            <MailingImage
                                src={imageSrc ?? pendingImageUrl}
                                readOnly={!editable}
                                disabled={busy}
                                onSelect={(file) =>
                                    mailing
                                        ? handleUpload(file, mailing.id).catch((error: unknown) =>
                                              notify(
                                                  'mailingImage',
                                                  parseServerErrors(error, []).message ?? t('error'),
                                                  'error'
                                              )
                                          )
                                        : setPendingImage(file)
                                }
                                onRemove={() =>
                                    mailing
                                        ? removeImage(mailing.id)
                                              .unwrap()
                                              .catch(() => notify('mailingImage', t('error'), 'error'))
                                        : setPendingImage(undefined)
                                }
                            />
                            <FieldHint>{t('admin-mailing-image-hint')}</FieldHint>
                        </FormSection>
                    </>
                )}

                {sendSection}

                {editable ? (
                    <FormActions
                        dirty={isDirty}
                        loading={saving || deleting}
                        disabled={loading}
                        saveDisabled={isCreate ? false : undefined}
                        saveLabel={isCreate ? t('admin-mailing-create') : t('admin-mailing-save')}
                        onSave={() => void handleSubmit(onSubmit, (errors) => scrollToFirstError(errors))()}
                        onCancel={() => confirmDiscard(() => void router.push(ADMIN_MAILINGS_HREF))}
                        onDelete={mailing ? () => setDeleteOpen(true) : undefined}
                        deleteLabel={t('admin-mailing-delete')}
                    />
                ) : (
                    <FieldHint>{t('admin-mailing-readonly')}</FieldHint>
                )}
            </div>

            <ConfirmationDialog {...dialogProps} />
            <ConfirmationDialog
                open={deleteOpen}
                message={t('admin-mailing-delete-confirm')}
                onConfirm={() => void handleDelete()}
                onCancel={() => setDeleteOpen(false)}
            />
            <ConfirmationDialog
                open={sendOpen}
                message={sendMessage}
                confirmLabel={t('admin-mailing-send')}
                onConfirm={() => (audienceTotal ? void handleSend() : audienceTotal === 0 && setSendOpen(false))}
                onCancel={() => setSendOpen(false)}
            />
            <ConfirmationDialog
                open={cancelOpen}
                message={t('admin-mailing-cancel-sending-confirm')}
                confirmLabel={t('admin-mailing-cancel-sending')}
                onConfirm={() => void handleCancel()}
                onCancel={() => setCancelOpen(false)}
            />
        </div>
    )
}
