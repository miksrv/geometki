import React, { useEffect, useMemo, useState } from 'react'
import { Button, Checkbox, cn, Dialog, Icon, Input, Skeleton } from 'simple-react-ui-kit'

import Image from 'next/image'
import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch } from '@/app/store'
import { IMG_HOST } from '@/config/env'
import { getErrorMessage } from '@/utils/api'
import { COLLECTION_TITLE_MAX_LENGTH } from '@/utils/helpers'

import styles from '../styles.module.sass'

interface AddToCollectionModalProps {
    placeId?: string
    open: boolean
    onClose: () => void
}

/** Search is only useful once the list no longer fits on one screen. */
const SEARCH_THRESHOLD = 6

const PickerRowLoader: React.FC = () => (
    <li
        className={styles.pickerRow}
        aria-hidden={true}
    >
        <div className={styles.pickerCover}>
            <Skeleton style={{ position: 'absolute', inset: 0 }} />
        </div>
        <div className={styles.pickerBody}>
            <Skeleton style={{ height: '14px', width: '60%', marginBottom: '6px' }} />
            <Skeleton style={{ height: '12px', width: '35%' }} />
        </div>
    </li>
)

/**
 * "Save to collection" picker for a place: every collection of the user is a row with
 * a checkbox, toggling it adds or removes the place. A new collection can be created
 * inline — the place is added to it right away.
 */
export const AddToCollectionModal: React.FC<AddToCollectionModalProps> = ({ placeId, open, onClose }) => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()

    const [search, setSearch] = useState('')
    const [createOpen, setCreateOpen] = useState(false)
    const [newTitle, setNewTitle] = useState('')
    const [pendingId, setPendingId] = useState<string | null>(null)

    const { data, isLoading } = API.useCollectionsGetMembershipQuery({ placeId }, { skip: !open })

    const [addPlaces] = API.useCollectionsAddPlacesMutation()
    const [removePlace] = API.useCollectionsRemovePlaceMutation()
    const [createCollection, { isLoading: createLoading }] = API.useCollectionsPostMutation()

    const allItems = data?.items ?? []
    const showSearch = allItems.length > SEARCH_THRESHOLD
    const hasCollections = !isLoading && allItems.length > 0

    const items = useMemo(() => {
        const query = search.trim().toLowerCase()

        return query ? allItems.filter((item) => item.title.toLowerCase().includes(query)) : allItems
    }, [allItems, search])

    // Reset transient state every time the picker is opened
    useEffect(() => {
        if (open) {
            setSearch('')
            setNewTitle('')
            setCreateOpen(false)
        }
    }, [open])

    // Without collections the only sensible action is creating one — show the form right away
    useEffect(() => {
        if (open && !isLoading && allItems.length === 0) {
            setCreateOpen(true)
        }
    }, [open, isLoading, allItems.length])

    const notifyError = (error: unknown) => {
        void dispatch(
            Notify({
                id: 'collectionToggleError',
                message: getErrorMessage(error),
                type: 'error'
            })
        )
    }

    const handleToggle = async (collectionId: string, contains: boolean) => {
        if (!placeId || pendingId) {
            return
        }

        setPendingId(collectionId)

        const result = contains
            ? await removePlace({ id: collectionId, placeId })
            : await addPlaces({ id: collectionId, placeIds: [placeId] })

        setPendingId(null)

        if ('error' in result) {
            notifyError(result.error)
            return
        }

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

    const handleCreate = async () => {
        const title = newTitle.trim()

        if (!title || !placeId || createLoading) {
            return
        }

        const result = await createCollection({ title })

        if ('error' in result) {
            notifyError(result.error)
            return
        }

        if (!result.data?.id) {
            return
        }

        const addResult = await addPlaces({ id: result.data.id, placeIds: [placeId] })

        if ('error' in addResult) {
            notifyError(addResult.error)
        }

        void dispatch(
            Notify({
                id: 'collectionCreated',
                title: '',
                message: `${t('collections_created-with-place', { defaultValue: 'Коллекция создана, место добавлено' })}: `,
                collection: { id: result.data.id, slug: result.data.slug, title },
                type: 'success'
            })
        )

        setNewTitle('')
        setCreateOpen(false)
    }

    // The whole row is the click target; the checkbox has its own onChange, so skip it here
    const handleRowClick = (event: React.MouseEvent, itemId: string, contains: boolean) => {
        if ((event.target as HTMLElement).closest('input')) {
            return
        }

        void handleToggle(itemId, contains)
    }

    const handleCreateCancel = () => {
        setNewTitle('')
        setCreateOpen(false)
    }

    return (
        <Dialog
            open={open}
            title={t('collections_add-to-collection-title', { defaultValue: 'В коллекцию' })}
            contentClassName={styles.picker}
            maxWidth={'420px'}
            onCloseDialog={onClose}
        >
            {showSearch && (
                <Input
                    className={styles.pickerSearch}
                    size={'medium'}
                    icon={'Search'}
                    clearable
                    placeholder={t('collections_search-placeholder', { defaultValue: 'Поиск по вашим коллекциям' })}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />
            )}

            {isLoading ? (
                <ul className={styles.pickerList}>
                    {Array(3)
                        .fill('')
                        .map((_, i) => (
                            <PickerRowLoader key={i} />
                        ))}
                </ul>
            ) : hasCollections ? (
                <ul className={styles.pickerList}>
                    {items.map((item) => {
                        const pending = pendingId === item.id

                        return (
                            <li
                                key={item.id}
                                className={cn(styles.pickerRow, pending && styles.pickerRowPending)}
                                onClick={(event) => handleRowClick(event, item.id, item.contains)}
                            >
                                <div className={styles.pickerCover}>
                                    {item.cover ? (
                                        <Image
                                            src={`${IMG_HOST}${item.cover.preview}`}
                                            alt={''}
                                            fill
                                            sizes={'40px'}
                                            style={{ objectFit: 'cover' }}
                                        />
                                    ) : (
                                        <Icon name={'Layers'} />
                                    )}
                                </div>

                                <div className={styles.pickerBody}>
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
                                    disabled={!!pendingId}
                                    onChange={() => void handleToggle(item.id, item.contains)}
                                />
                            </li>
                        )
                    })}

                    {!items.length && (
                        <li className={styles.pickerEmpty}>
                            {t('nothing-found', { defaultValue: 'Ничего не найдено' })}
                        </li>
                    )}
                </ul>
            ) : (
                <div className={styles.pickerEmpty}>
                    <strong>{t('collections_picker-empty-title', { defaultValue: 'У вас пока нет коллекций' })}</strong>
                    <span>
                        {t('collections_picker-empty-description', {
                            defaultValue: 'Создайте первую — это место сразу попадёт в неё'
                        })}
                    </span>
                </div>
            )}

            <div className={cn(styles.pickerFooter, !hasCollections && styles.pickerFooterBare)}>
                {createOpen ? (
                    <div className={styles.pickerCreate}>
                        <Input
                            autoFocus
                            size={'medium'}
                            placeholder={t('collections_title-placeholder', {
                                defaultValue: 'Например, Водопады Карелии'
                            })}
                            value={newTitle}
                            disabled={createLoading}
                            maxLength={COLLECTION_TITLE_MAX_LENGTH}
                            onChange={(event) => setNewTitle(event.target.value.slice(0, COLLECTION_TITLE_MAX_LENGTH))}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault()
                                    void handleCreate()
                                } else if (event.key === 'Escape' && hasCollections) {
                                    event.stopPropagation()
                                    handleCreateCancel()
                                }
                            }}
                        />
                        <div className={styles.pickerCreateActions}>
                            <span className={styles.charCounter}>
                                {newTitle.length}/{COLLECTION_TITLE_MAX_LENGTH}
                            </span>
                            <div className={styles.dialogActions}>
                                {hasCollections && (
                                    <Button
                                        mode={'secondary'}
                                        size={'medium'}
                                        disabled={createLoading}
                                        onClick={handleCreateCancel}
                                    >
                                        {t('cancel')}
                                    </Button>
                                )}
                                <Button
                                    mode={'primary'}
                                    size={'medium'}
                                    disabled={!newTitle.trim() || createLoading}
                                    loading={createLoading}
                                    onClick={() => void handleCreate()}
                                >
                                    {t('create', { defaultValue: 'Создать' })}
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <Button
                        mode={'outline'}
                        size={'medium'}
                        icon={'PlusCircle'}
                        stretched
                        label={t('collections_new-collection-button', { defaultValue: 'Новая коллекция' })}
                        onClick={() => setCreateOpen(true)}
                    />
                )}
            </div>
        </Dialog>
    )
}
