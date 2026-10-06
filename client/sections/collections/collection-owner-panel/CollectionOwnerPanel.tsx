import React, { useMemo, useState } from 'react'
import { Button, Container, Input, Select, SelectOptionType, Skeleton } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel } from '@/api'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch } from '@/app/store'
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog'
import { Tabs } from '@/components/ui'
import { IMG_HOST } from '@/config/env'
import { getErrorMessage } from '@/utils/api'
import { COLLECTION_META_DESCRIPTION_MAX_LENGTH, COLLECTION_TITLE_MAX_LENGTH } from '@/utils/helpers'

import styles from '../styles.module.sass'

const ContentEditor = dynamic(
    () => import('@/components/ui/content-editor/ContentEditor').then((m) => ({ default: m.ContentEditor })),
    { ssr: false }
)

enum AddPlacesTab {
    SEARCH = 'search',
    RECOMMENDED = 'recommended'
}

interface CollectionOwnerPanelProps {
    collection: ApiModel.Collection
}

const AddPlaceRowLoader: React.FC = () => (
    <li className={styles.modalRow}>
        <div className={styles.modalRowBody}>
            <Skeleton style={{ height: '14px', width: '70%' }} />
        </div>
        <Skeleton style={{ height: '36px', width: '92px', borderRadius: 'var(--border-radius)' }} />
    </li>
)

/**
 * Owner edit mode: title/description/meta/theme/cover fields, an "add places" panel
 * with "Поиск" and "Рекомендуем" tabs, and the delete action. Map-picking and drag-and-drop
 * reorder are planned for a later phase and are intentionally not built here.
 */
export const CollectionOwnerPanel: React.FC<CollectionOwnerPanelProps> = ({ collection }) => {
    const { t } = useTranslation()
    const router = useRouter()
    const dispatch = useAppDispatch()

    const notifyIfError = (result: { error?: unknown }) => {
        if (result && 'error' in result && result.error) {
            void dispatch(
                Notify({ id: 'collectionOwnerPanelError', message: getErrorMessage(result.error), type: 'error' })
            )
        }
    }

    const [title, setTitle] = useState(collection.title)
    const [description, setDescription] = useState(collection.description ?? '')
    const [metaDescription, setMetaDescription] = useState(collection.metaDescription ?? '')
    const [category, setCategory] = useState<string | null>(collection.category?.name ?? null)
    const [region, setRegion] = useState<number | null>(collection.region?.id ?? null)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [addTab, setAddTab] = useState<AddPlacesTab>(AddPlacesTab.SEARCH)
    const [searchValue, setSearchValue] = useState('')

    const [patchCollection, { isLoading: savingLoading }] = API.useCollectionsPatchMutation()
    const [deleteCollection, { isLoading: deleteLoading }] = API.useCollectionsDeleteMutation()
    const [addPlaces, { isLoading: addLoading }] = API.useCollectionsAddPlacesMutation()

    const { data: categoryData } = API.useCategoriesGetListQuery()
    const [searchAddress, { data: addressData }] = API.useLocationGetSearchMutation()
    const {
        data: searchData,
        isFetching: searchFetching,
        isLoading: searchLoading
    } = API.usePlacesGetListQuery(
        { search: searchValue, limit: 10 },
        { skip: addTab !== AddPlacesTab.SEARCH || searchValue.trim().length < 2 }
    )
    const {
        data: recommendedData,
        isFetching: recommendedFetching,
        isLoading: recommendedLoading
    } = API.useCollectionsGetRecommendedQuery(
        { id: collection.id, limit: 20 },
        { skip: addTab !== AddPlacesTab.RECOMMENDED }
    )

    const categoryOptions = useMemo<Array<SelectOptionType<string>>>(
        () => categoryData?.items?.map((item) => ({ key: item.name, value: item.title })) ?? [],
        [categoryData?.items]
    )

    const regionOptions = useMemo<Array<SelectOptionType<string>>>(() => {
        const base = addressData?.regions?.map((item) => ({ key: String(item.id), value: item.name })) ?? []
        if (collection.region && !base.find((o) => o.key === String(collection.region?.id))) {
            base.unshift({ key: String(collection.region.id), value: collection.region.name })
        }
        return base
    }, [addressData?.regions, collection.region])

    const originalCategory = collection.category?.name ?? null
    const originalRegion = collection.region?.id ?? null

    const isDirty =
        title !== collection.title ||
        description !== (collection.description ?? '') ||
        metaDescription !== (collection.metaDescription ?? '') ||
        category !== originalCategory ||
        region !== originalRegion

    const handleSave = async () => {
        const result = await patchCollection({
            category,
            description: description || null,
            id: collection.id,
            metaDescription: metaDescription || null,
            region,
            title
        })

        notifyIfError(result)

        if (!('error' in result)) {
            void dispatch(
                Notify({
                    id: 'collectionOwnerPanelSave',
                    title: '',
                    message: t('collections_saved', { defaultValue: 'Изменения сохранены' }),
                    type: 'success'
                })
            )
        }
    }

    const handlePickCover = async (placeId: string) => {
        const result = await patchCollection({ coverPlaceId: placeId, id: collection.id })
        notifyIfError(result)

        if (!('error' in result)) {
            void dispatch(
                Notify({
                    id: 'collectionOwnerPanelCover',
                    title: '',
                    message: t('collections_cover-updated', { defaultValue: 'Обложка коллекции обновлена' }),
                    type: 'success'
                })
            )
        }
    }

    const handleDelete = async () => {
        const result = await deleteCollection(collection.id)
        notifyIfError(result)
        if (!('error' in result)) {
            await router.push('/collections')
        }
    }

    const handleAddOne = async (placeId: string) => {
        notifyIfError(await addPlaces({ id: collection.id, placeIds: [placeId] }))
    }

    const handleAddAll = async () => {
        const ids = recommendedData?.items?.map((p) => p.id) ?? []
        if (ids.length) {
            notifyIfError(await addPlaces({ id: collection.id, placeIds: ids }))
        }
    }

    const existingIds = new Set((collection.places ?? []).map((p) => p.id))

    return (
        <Container title={t('collections_edit-collection', { defaultValue: 'Редактирование коллекции' })}>
            <div className={styles.ownerField}>
                <Input
                    label={t('collections_title-label', { defaultValue: 'Название' })}
                    value={title}
                    maxLength={COLLECTION_TITLE_MAX_LENGTH}
                    onChange={(event) => setTitle(event.target.value.slice(0, COLLECTION_TITLE_MAX_LENGTH))}
                />
                <span className={styles.charCounter}>
                    {title.length}/{COLLECTION_TITLE_MAX_LENGTH}
                </span>
            </div>

            <div className={styles.ownerField}>
                <ContentEditor
                    value={description}
                    placeholder={t('collections_description-placeholder', {
                        defaultValue: 'Расскажите, чем интересны эти места, как до них добраться, когда лучше ехать'
                    })}
                    onChange={setDescription}
                />
            </div>

            <div className={styles.ownerField}>
                <Input
                    label={t('collections_meta-description-label', { defaultValue: 'Мета-описание' })}
                    value={metaDescription}
                    maxLength={COLLECTION_META_DESCRIPTION_MAX_LENGTH}
                    onChange={(event) =>
                        setMetaDescription(event.target.value.slice(0, COLLECTION_META_DESCRIPTION_MAX_LENGTH))
                    }
                />
                <span className={styles.charCounter}>
                    {metaDescription.length}/{COLLECTION_META_DESCRIPTION_MAX_LENGTH}
                </span>
            </div>

            <div className={styles.ownerField}>
                <Select<string>
                    label={t('collections_category-label', { defaultValue: 'Категория' })}
                    options={categoryOptions}
                    value={category ? [category] : undefined}
                    onSelect={(selected) => setCategory(selected?.[0]?.key ?? null)}
                />
            </div>

            <div className={styles.ownerField}>
                <Select<string>
                    searchable
                    label={t('collections_region-label', { defaultValue: 'Регион' })}
                    options={regionOptions}
                    value={region ? [String(region)] : undefined}
                    onSearch={(value) => void searchAddress(value)}
                    onSelect={(selected) => setRegion(selected?.[0]?.key ? Number(selected[0].key) : null)}
                />
            </div>

            {!!collection.places?.length && (
                <div className={styles.ownerField}>
                    <p>{t('collections_cover-label', { defaultValue: 'Обложка коллекции' })}</p>
                    <div className={styles.coverPicker}>
                        {collection.places
                            .filter((place) => place.cover)
                            .map((place) => (
                                <Button
                                    key={place.id}
                                    mode={'outline'}
                                    tooltip={t('collections_pick-cover', {
                                        defaultValue: 'Сделать обложкой: {{title}}',
                                        title: place.title
                                    })}
                                    onClick={() => void handlePickCover(place.id)}
                                >
                                    {/* eslint-disable-next-line next/no-img-element */}
                                    <img
                                        src={`${IMG_HOST}${place.cover?.preview}`}
                                        alt={''}
                                        width={72}
                                        height={54}
                                    />
                                </Button>
                            ))}
                    </div>
                </div>
            )}

            <div className={styles.ownerActions}>
                <Button
                    mode={'primary'}
                    loading={savingLoading}
                    disabled={!title.trim() || !isDirty || savingLoading}
                    onClick={handleSave}
                >
                    {t('save')}
                </Button>

                <Button
                    mode={'secondary'}
                    variant={'negative'}
                    onClick={() => setDeleteOpen(true)}
                >
                    {t('collections_delete-collection', { defaultValue: 'Удалить коллекцию' })}
                </Button>
            </div>

            <Tabs<AddPlacesTab>
                title={t('collections_add-places', { defaultValue: 'Добавить места' })}
                tabs={[
                    { key: AddPlacesTab.SEARCH, label: t('collections_tab-search', { defaultValue: 'Поиск' }) },
                    {
                        key: AddPlacesTab.RECOMMENDED,
                        label: t('collections_tab-recommended', { defaultValue: 'Рекомендуем' })
                    }
                ]}
                activeTab={addTab}
                onChangeTab={(key) => key && setAddTab(key)}
            >
                {addTab === AddPlacesTab.SEARCH && (
                    <div className={styles.ownerField}>
                        <Input
                            placeholder={t('collections_search-places-placeholder', {
                                defaultValue: 'Начните вводить название места'
                            })}
                            value={searchValue}
                            onChange={(event) => setSearchValue(event.target.value)}
                        />

                        {searchLoading || searchFetching ? (
                            <ul className={styles.modalList}>
                                {Array(4)
                                    .fill('')
                                    .map((_, i) => (
                                        <AddPlaceRowLoader key={i} />
                                    ))}
                            </ul>
                        ) : (
                            <ul className={styles.modalList}>
                                {searchData?.items
                                    ?.filter((place) => !existingIds.has(place.id))
                                    .map((place) => (
                                        <li
                                            key={place.id}
                                            className={styles.modalRow}
                                        >
                                            <div className={styles.modalRowBody}>
                                                <strong>{place.title}</strong>
                                            </div>
                                            <Button
                                                mode={'secondary'}
                                                size={'large'}
                                                disabled={addLoading}
                                                onClick={() => void handleAddOne(place.id)}
                                            >
                                                {t('collections_add-button', { defaultValue: 'Добавить' })}
                                            </Button>
                                        </li>
                                    ))}

                                {searchValue.trim().length < 2 && (
                                    <li className={styles.noResults}>
                                        {t('collections_search-hint', {
                                            defaultValue: 'Введите не менее 2 символов'
                                        })}
                                    </li>
                                )}

                                {searchValue.trim().length >= 2 && !searchData?.items?.length && (
                                    <li className={styles.noResults}>
                                        {t('nothing-found', { defaultValue: 'Ничего не найдено' })}
                                    </li>
                                )}
                            </ul>
                        )}
                    </div>
                )}

                {addTab === AddPlacesTab.RECOMMENDED && (
                    <div className={styles.ownerField}>
                        {!!recommendedData?.items?.length && (
                            <Button
                                mode={'primary'}
                                size={'large'}
                                disabled={addLoading}
                                onClick={handleAddAll}
                            >
                                {t('collections_add-all-button', { defaultValue: 'Добавить все' })}
                            </Button>
                        )}

                        {recommendedLoading || recommendedFetching ? (
                            <ul className={styles.modalList}>
                                {Array(4)
                                    .fill('')
                                    .map((_, i) => (
                                        <AddPlaceRowLoader key={i} />
                                    ))}
                            </ul>
                        ) : (
                            <ul className={styles.modalList}>
                                {recommendedData?.items
                                    ?.filter((place) => !existingIds.has(place.id))
                                    .map((place) => (
                                        <li
                                            key={place.id}
                                            className={styles.modalRow}
                                        >
                                            <div className={styles.modalRowBody}>
                                                <strong>{place.title}</strong>
                                            </div>
                                            <Button
                                                mode={'secondary'}
                                                size={'large'}
                                                disabled={addLoading}
                                                onClick={() => void handleAddOne(place.id)}
                                            >
                                                {t('collections_add-button', { defaultValue: 'Добавить' })}
                                            </Button>
                                        </li>
                                    ))}

                                {!recommendedData?.items?.length && (
                                    <li className={styles.noResults}>
                                        {t('nothing-found', { defaultValue: 'Ничего не найдено' })}
                                    </li>
                                )}
                            </ul>
                        )}
                    </div>
                )}
            </Tabs>

            <ConfirmationDialog
                open={deleteOpen}
                message={t('collections_delete-confirm', {
                    defaultValue: 'Удалить коллекцию? Это действие нельзя отменить.'
                })}
                onConfirm={handleDelete}
                onCancel={() => setDeleteOpen(false)}
                confirmLabel={deleteLoading ? t('collections_deleting', { defaultValue: 'Удаление…' }) : undefined}
            />
        </Container>
    )
}
