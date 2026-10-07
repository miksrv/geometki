import React, { useEffect, useState } from 'react'
import { Button, Dialog, Input } from 'simple-react-ui-kit'

import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch } from '@/app/store'
import { getErrorMessage } from '@/utils/api'
import { buildCollectionUrl, COLLECTION_TITLE_MAX_LENGTH } from '@/utils/helpers'

import styles from '../styles.module.sass'

export interface CreatedCollection {
    id: string
    slug: string | null
    title: string
}

interface CreateCollectionDialogProps {
    open: boolean
    onClose: () => void
    /** Called after a successful create. When omitted, the new collection page is opened. */
    onCreated?: (collection: CreatedCollection) => void
}

/**
 * Minimal "new collection" dialog: a title is all that is required, everything else
 * (description, cover, places) is edited on the collection page itself.
 */
export const CreateCollectionDialog: React.FC<CreateCollectionDialogProps> = ({ open, onClose, onCreated }) => {
    const { t } = useTranslation()
    const router = useRouter()
    const dispatch = useAppDispatch()

    const [title, setTitle] = useState('')

    const [createCollection, { isLoading }] = API.useCollectionsPostMutation()

    useEffect(() => {
        if (!open) {
            setTitle('')
        }
    }, [open])

    const trimmedTitle = title.trim()

    const handleSubmit = async () => {
        if (!trimmedTitle || isLoading) {
            return
        }

        const result = await createCollection({ title: trimmedTitle })

        if ('error' in result) {
            void dispatch(
                Notify({
                    id: 'collectionCreateError',
                    message: getErrorMessage(result.error),
                    type: 'error'
                })
            )
            return
        }

        if (!result.data?.id) {
            return
        }

        const created: CreatedCollection = { id: result.data.id, slug: result.data.slug, title: trimmedTitle }

        void dispatch(
            Notify({
                id: 'collectionCreated',
                title: '',
                message: `${t('collections_created', { defaultValue: 'Коллекция создана' })}: `,
                collection: created,
                type: 'success'
            })
        )

        onClose()

        if (onCreated) {
            onCreated(created)
        } else {
            void router.push(buildCollectionUrl(created.id, created.slug))
        }
    }

    return (
        <Dialog
            open={open}
            title={t('collections_create-title', { defaultValue: 'Новая коллекция' })}
            contentClassName={styles.createDialog}
            maxWidth={'420px'}
            onCloseDialog={onClose}
        >
            <Input
                autoFocus
                size={'medium'}
                label={t('collections_title-label', { defaultValue: 'Название' })}
                placeholder={t('collections_title-placeholder', { defaultValue: 'Например, Водопады Карелии' })}
                value={title}
                disabled={isLoading}
                maxLength={COLLECTION_TITLE_MAX_LENGTH}
                onChange={(event) => setTitle(event.target.value.slice(0, COLLECTION_TITLE_MAX_LENGTH))}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault()
                        void handleSubmit()
                    }
                }}
            />
            <div className={styles.createDialogMeta}>
                <span className={styles.createDialogHint}>
                    {t('collections_create-hint', {
                        defaultValue: 'Описание, обложку и места можно добавить на странице коллекции'
                    })}
                </span>
                <span className={styles.charCounter}>
                    {title.length}/{COLLECTION_TITLE_MAX_LENGTH}
                </span>
            </div>

            <div className={styles.dialogActions}>
                <Button
                    mode={'secondary'}
                    size={'medium'}
                    disabled={isLoading}
                    onClick={onClose}
                >
                    {t('cancel')}
                </Button>
                <Button
                    mode={'primary'}
                    size={'medium'}
                    disabled={!trimmedTitle || isLoading}
                    loading={isLoading}
                    onClick={() => void handleSubmit()}
                >
                    {t('create', { defaultValue: 'Создать' })}
                </Button>
            </div>
        </Dialog>
    )
}
