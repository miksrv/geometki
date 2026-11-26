import React, { useRef, useState } from 'react'
import { Button } from 'simple-react-ui-kit'

import Image from 'next/image'
import { useTranslation } from 'next-i18next/pages'

import { Notify } from '@/app/notificationSlice'
import { useAppDispatch } from '@/app/store'
import { UploadZone } from '@/components/ui'

import styles from './styles.module.sass'

/** What a mail client shows: no WebP, no SVG; the API takes these up to 2 MB */
export const MAILING_IMAGE_TYPES = ['image/jpeg', 'image/png']
export const MAILING_IMAGE_MAX_SIZE = 2 * 1024 * 1024

interface MailingImageProps {
    /** The picture to show: the saved one, or the one picked for a mailing not saved yet */
    src?: string
    /** A sent mailing: its picture is only shown */
    readOnly?: boolean
    disabled?: boolean
    /** Takes a checked file: uploads it, or keeps it until the mailing is saved; rejects when refused */
    onSelect: (file: File) => Promise<unknown> | void
    onRemove?: () => Promise<unknown> | void
}

/**
 * The picture at the top of the letter (DESIGN.md → Patterns → Photo upload): the upload zone
 * while there is none — a click or a dropped file — then the picture as the letter shows it,
 * with "Заменить" and "Удалить". The type and the size are checked before sending.
 */
export const MailingImage: React.FC<MailingImageProps> = ({ src, readOnly, disabled, onSelect, onRemove }) => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()
    const inputRef = useRef<HTMLInputElement>(null)
    const [busy, setBusy] = useState<boolean>(false)

    const take = async (file?: File) => {
        if (!file) {
            return
        }

        if (!MAILING_IMAGE_TYPES.includes(file.type) || file.size > MAILING_IMAGE_MAX_SIZE) {
            void dispatch(
                Notify({ id: 'mailingImage', message: t('admin-mailing-image-rejected'), title: '', type: 'error' })
            )
            return
        }

        setBusy(true)

        try {
            await onSelect(file)
        } finally {
            setBusy(false)
        }
    }

    const handleRemove = async () => {
        setBusy(true)

        try {
            await onRemove?.()
        } finally {
            setBusy(false)
        }
    }

    const input = (
        <input
            ref={inputRef}
            type={'file'}
            hidden={true}
            accept={MAILING_IMAGE_TYPES.join(', ')}
            data-testid={'mailing-image-input'}
            onChange={(event) => {
                const file = event.target.files?.[0]
                // The same file can be picked again after a refusal
                event.target.value = ''
                void take(file)
            }}
        />
    )

    if (!src) {
        return readOnly ? (
            <p className={styles.noImage}>{t('admin-mailing-image-none')}</p>
        ) : (
            <>
                {input}
                <UploadZone
                    icon={'Photo'}
                    title={t('admin-mailing-image-upload-title')}
                    hint={t('admin-mailing-image-upload-hint')}
                    disabled={disabled || busy}
                    onClick={() => inputRef.current?.click()}
                    onDrop={(files) => void take(files[0])}
                />
            </>
        )
    }

    return (
        <div className={styles.picture}>
            {/* As wide as the letter shows it; the file (or a picked one, a blob) is shown as it is */}
            <Image
                className={styles.pictureImage}
                src={src}
                alt={''}
                width={600}
                height={300}
                unoptimized={true}
            />

            {!readOnly && (
                <div className={styles.row}>
                    {input}
                    <Button
                        size={'small'}
                        mode={'secondary'}
                        icon={'Photo'}
                        label={t('admin-mailing-image-replace')}
                        disabled={disabled || busy}
                        loading={busy}
                        onClick={() => inputRef.current?.click()}
                    />
                    {onRemove && (
                        <Button
                            size={'small'}
                            mode={'secondary'}
                            variant={'negative'}
                            label={t('admin-mailing-image-remove')}
                            disabled={disabled || busy}
                            onClick={() => void handleRemove()}
                        />
                    )}
                </div>
            )}
        </div>
    )
}
