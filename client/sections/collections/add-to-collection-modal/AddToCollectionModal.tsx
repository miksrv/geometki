import React, { useMemo, useState } from 'react'
import { Button, Checkbox, Dialog, Input, Skeleton } from 'simple-react-ui-kit'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch } from '@/app/store'
import { IMG_HOST } from '@/config/env'
import { getErrorMessage } from '@/utils/api'
import { buildCollectionUrl, COLLECTION_TITLE_MAX_LENGTH } from '@/utils/helpers'

import styles from '../styles.module.sass'

interface AddToCollectionModalProps {
    placeId?: string
    open: boolean
    onClose: () => void
}

const ModalRowLoader: React.FC = () => (
    <li className={styles.modalRow}>
        <div className={styles.modalRowCover}>
            <Skeleton style={{ position: 'absolute', inset: 0 }} />
        </div>
        <div className={styles.modalRowBody}>
            <Skeleton style={{ height: '14px', width: '60%', marginBottom: '6px' }} />
            <Skeleton style={{ height: '12px', width: '35%' }} />
        </div>
    </li>
)

export const AddToCollectionModal: React.FC<AddToCollectionModalProps> = ({ placeId, open, onClose }) => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()

    const [search, setSearch] = useState('')
    const [newTitle, setNewTitle] = useState('')
    const [createdCollection, setCreatedCollection] = useState<{ id: string; slug?: string | null } | null>(null)

    const { data, isLoading } = API.useCollectionsGetMembershipQuery({ placeId }, { skip: !open })

    const [addPlaces, { isLoading: addLoading }] = API.useCollectionsAddPlacesMutation()
    const [removePlace, { isLoading: removeLoading }] = API.useCollectionsRemovePlaceMutation()
    const [createCollection, { isLoading: createLoading }] = API.useCollectionsPostMutation()

    const items = useMemo(
        () => (data?.items ?? []).filter((item) => item.title.toLowerCase().includes(search.trim().toLowerCase())),
        [data?.items, search]
    )

    const handleToggle = async (collectionId: string, contains: boolean) => {
        if (!placeId) {
            return
        }

        const result = contains
            ? await removePlace({ id: collectionId, placeId })
            : await addPlaces({ id: collectionId, placeIds: [placeId] })

        if ('error' in result) {
            void dispatch(
                Notify({
                    id: 'collectionToggleError',
                    message: getErrorMessage(result.error),
                    type: 'error'
                })
            )
        } else {
            void dispatch(
                Notify({
                    id: 'collectionToggle',
                    title: '',
                    message: contains
                        ? t('collections_removed-from-collection', { defaultValue: 'Место удалено из коллекции' })
                        : t('collections_added-to-collection', { defaultValue: 'Место добавлено в коллекцию' }),
                    type: 'success'
                })
            )
        }
    }

    const handleCreate = async () => {
        const title = newTitle.trim()

        if (!title || !placeId) {
            return
        }

        const result = await createCollection({ title })

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

        if (result.data?.id) {
            const addResult = await addPlaces({ id: result.data.id, placeIds: [placeId] })

            if ('error' in addResult) {
                void dispatch(
                    Notify({
                        id: 'collectionCreateError',
                        message: getErrorMessage(addResult.error),
                        type: 'error'
                    })
                )
            }

            setCreatedCollection({ id: result.data.id, slug: result.data.slug })
            setNewTitle('')
        }
    }

    const busy = addLoading || removeLoading || createLoading

    // Clicking anywhere in the row toggles the collection, except on the checkbox itself
    // (its own onChange already handles that) — gives the row a full-width ≥44px touch target.
    const handleRowClick = (event: React.MouseEvent, itemId: string, contains: boolean) => {
        if ((event.target as HTMLElement).closest('input')) {
            return
        }
        void handleToggle(itemId, contains)
    }

    return (
        <Dialog
            open={open}
            title={t('collections_add-to-collection-title', { defaultValue: 'В коллекцию' })}
            contentClassName={styles.modal}
            maxWidth={'480px'}
            onCloseDialog={onClose}
        >
            <Input
                className={styles.modalSearch}
                placeholder={t('collections_search-placeholder', { defaultValue: 'Поиск по вашим коллекциям' })}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
            />

            {isLoading ? (
                <ul className={styles.modalList}>
                    {Array(4)
                        .fill('')
                        .map((_, i) => (
                            <ModalRowLoader key={i} />
                        ))}
                </ul>
            ) : (
                <ul className={styles.modalList}>
                    {items.map((item) => (
                        <li
                            key={item.id}
                            className={styles.modalRow}
                            onClick={(event) => handleRowClick(event, item.id, item.contains)}
                        >
                            <div className={styles.modalRowCover}>
                                {item.cover && (
                                    <Image
                                        src={`${IMG_HOST}${item.cover.preview}`}
                                        alt={''}
                                        fill
                                        sizes={'40px'}
                                        style={{ objectFit: 'cover' }}
                                    />
                                )}
                            </div>

                            <div className={styles.modalRowBody}>
                                <strong>{item.title}</strong>
                                <span>
                                    {t('collections_places-count', {
                                        count: item.placesCount,
                                        defaultValue: '{{count}} мест'
                                    })}
                                </span>
                            </div>

                            <Checkbox
                                id={`collection-${item.id}`}
                                aria-label={item.title}
                                checked={item.contains}
                                disabled={busy}
                                onChange={() => void handleToggle(item.id, item.contains)}
                            />
                        </li>
                    ))}

                    {!items.length && (
                        <li className={styles.noResults}>
                            {t('nothing-found', { defaultValue: 'Ничего не найдено' })}
                        </li>
                    )}
                </ul>
            )}

            <div className={styles.modalNewCollection}>
                <div>
                    <Input
                        placeholder={t('collections_new-collection-placeholder', {
                            defaultValue: '+ Новая коллекция'
                        })}
                        value={newTitle}
                        disabled={busy}
                        maxLength={COLLECTION_TITLE_MAX_LENGTH}
                        onChange={(event) => setNewTitle(event.target.value.slice(0, COLLECTION_TITLE_MAX_LENGTH))}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                void handleCreate()
                            }
                        }}
                    />
                    <span className={styles.charCounter}>
                        {newTitle.length}/{COLLECTION_TITLE_MAX_LENGTH}
                    </span>
                </div>
                <Button
                    mode={'primary'}
                    size={'large'}
                    disabled={!newTitle.trim() || busy}
                    loading={createLoading}
                    onClick={handleCreate}
                >
                    {t('create', { defaultValue: 'Создать' })}
                </Button>
            </div>

            {/* After creating from here the collection has only a title; link to finish it. */}
            {createdCollection && (
                <p>
                    <Link href={buildCollectionUrl(createdCollection.id, createdCollection.slug)}>
                        {t('collections_open-and-finish', { defaultValue: 'Открыть и дописать описание' })}
                    </Link>
                </p>
            )}
        </Dialog>
    )
}
