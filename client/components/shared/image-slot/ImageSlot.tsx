import React, { useRef, useState } from 'react'
import { Button } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { Notify } from '@/app/notificationSlice'
import { useAppDispatch } from '@/app/store'
import { getErrorMessage } from '@/utils/api'

import styles from './styles.module.sass'

export const IMAGE_SLOT_ACCEPT = ['image/png', 'image/svg+xml']
export const IMAGE_SLOT_MAX_SIZE = 1024 * 1024

export interface ImageSlotProps {
    /** What the picture is ("Золото, 1 место"): the caption and the buttons' accessible names */
    label: string
    /** The picture as it is now (the drawn badge stands in while there is none) */
    preview: React.ReactNode
    /** There is a picture: the button says "Заменить" and the remove button shows */
    hasImage: boolean
    /** Uploading is not possible now (the entity is not saved yet) */
    disabled?: boolean
    /** Saves the picture at once; rejects when the server refuses */
    onUpload: (file: File) => Promise<unknown>
    /** Takes the picture off; no remove button without it */
    onRemove?: () => Promise<unknown>
    /** Distinguishes the slot's toasts */
    id: string
}

/**
 * One picture of an admin form: its preview, what it is, "Загрузить" / "Заменить" and a remove
 * button. PNG or SVG up to 1 MB, checked before the upload; a refused file, a failed upload
 * and a saved one all say so in a toast. The change is saved at once, apart from the form's
 * own Save.
 */
export const ImageSlot: React.FC<ImageSlotProps> = ({ label, preview, hasImage, disabled, onUpload, onRemove, id }) => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()
    const inputRef = useRef<HTMLInputElement>(null)
    const [busy, setBusy] = useState<boolean>(false)

    const notify = (type: 'error' | 'success', message: string) =>
        void dispatch(Notify({ id: `image-slot-${id}`, message, title: '', type }))

    const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        // Lets the same file be picked again
        event.target.value = ''

        if (!file) {
            return
        }

        // Some systems give an SVG no type: then its name tells (the server checks the content anyway)
        const accepted = file.type ? IMAGE_SLOT_ACCEPT.includes(file.type) : /\.(png|svg)$/i.test(file.name)

        if (!accepted || file.size > IMAGE_SLOT_MAX_SIZE) {
            notify('error', t('admin-image-rejected'))
            return
        }

        setBusy(true)

        try {
            await onUpload(file)
            notify('success', t('admin-image-saved'))
        } catch (error) {
            notify('error', getErrorMessage(error) ?? t('admin-image-failed'))
        } finally {
            setBusy(false)
        }
    }

    const handleRemove = async () => {
        if (!onRemove) {
            return
        }

        setBusy(true)

        try {
            await onRemove()
            notify('success', t('admin-image-removed'))
        } catch (error) {
            notify('error', getErrorMessage(error) ?? t('admin-image-failed'))
        } finally {
            setBusy(false)
        }
    }

    const action = hasImage ? t('admin-image-replace') : t('admin-image-upload')

    return (
        <li className={styles.slot}>
            <span className={styles.preview}>{preview}</span>

            <span className={styles.slotLabel}>{label}</span>

            <input
                ref={inputRef}
                type={'file'}
                accept={IMAGE_SLOT_ACCEPT.join(',')}
                hidden={true}
                tabIndex={-1}
                aria-hidden={true}
                data-testid={`image-slot-input-${id}`}
                onChange={(event) => void handleChange(event)}
            />

            <span className={styles.slotActions}>
                <Button
                    mode={'secondary'}
                    size={'small'}
                    disabled={busy || disabled}
                    loading={busy}
                    label={action}
                    aria-label={`${action}: ${label}`}
                    onClick={() => inputRef.current?.click()}
                />
                {hasImage && onRemove && (
                    <Button
                        mode={'secondary'}
                        variant={'negative'}
                        size={'small'}
                        icon={'Close'}
                        disabled={busy || disabled}
                        aria-label={`${t('admin-image-remove')}: ${label}`}
                        tooltip={t('admin-image-remove')}
                        onClick={() => void handleRemove()}
                    />
                )}
            </span>
        </li>
    )
}
