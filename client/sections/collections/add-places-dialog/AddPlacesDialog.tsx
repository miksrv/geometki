import React, { useEffect, useMemo, useState } from 'react'
import { Button, cn, Dialog, Icon, Input, Skeleton } from 'simple-react-ui-kit'

import Image from 'next/image'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel } from '@/api'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch } from '@/app/store'
import { collectionPickerStyles } from '@/components/shared/add-to-collection'
import { IMG_HOST } from '@/config/env'
import { addressToString } from '@/utils/address'
import { getErrorMessage } from '@/utils/api'

import styles from '../styles.module.sass'

type AddPlacesTab = 'search' | 'recommended'

const SEARCH_MIN_LENGTH = 2
const SEARCH_DEBOUNCE_MS = 300
const RECOMMENDED_LIMIT = 20

interface AddPlacesDialogProps {
    collection: ApiModel.Collection
    open: boolean
    onClose: () => void
}

const RowLoader: React.FC = () => (
    <li
        className={collectionPickerStyles.pickerRow}
        aria-hidden={true}
    >
        <div className={collectionPickerStyles.pickerCover}>
            <Skeleton style={{ position: 'absolute', inset: 0 }} />
        </div>
        <div className={collectionPickerStyles.pickerBody}>
            <Skeleton style={{ height: '14px', width: '60%', marginBottom: '6px' }} />
            <Skeleton style={{ height: '12px', width: '40%' }} />
        </div>
        <Skeleton style={{ height: '28px', width: '90px', borderRadius: 'var(--border-radius)' }} />
    </li>
)

/**
 * "Добавить места" dialog for the owner: search by title or pick from places recommended
 * by the collection's region. Places already in the collection are hidden, so a place
 * disappears from the list as soon as it is added.
 */
export const AddPlacesDialog: React.FC<AddPlacesDialogProps> = ({ collection, open, onClose }) => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()

    const [tab, setTab] = useState<AddPlacesTab>('search')
    const [search, setSearch] = useState('')
    const [query, setQuery] = useState('')
    const [pendingId, setPendingId] = useState<string | null>(null)

    const [addPlaces, { isLoading: addLoading }] = API.useCollectionsAddPlacesMutation()

    const canSearch = query.length >= SEARCH_MIN_LENGTH
    const hasRegion = !!collection.region

    // Only the debounced query hits the API; `data` keeps the previous result while the
    // next one loads, so the list never collapses into skeletons between keystrokes.
    const {
        data: searchData,
        isFetching: searchFetching,
        isLoading: searchLoading
    } = API.usePlacesGetListQuery({ search: query, limit: 10 }, { skip: !open || tab !== 'search' || !canSearch })

    const {
        data: recommendedData,
        isFetching: recommendedFetching,
        isLoading: recommendedLoading
    } = API.useCollectionsGetRecommendedQuery(
        { id: collection.id, limit: RECOMMENDED_LIMIT },
        { skip: !open || tab !== 'recommended' || !hasRegion }
    )

    useEffect(() => {
        if (open) {
            setTab('search')
            setSearch('')
            setQuery('')
        }
    }, [open])

    useEffect(() => {
        const trimmed = search.trim()

        if (trimmed.length < SEARCH_MIN_LENGTH) {
            setQuery(trimmed)
            return
        }

        const timer = setTimeout(() => setQuery(trimmed), SEARCH_DEBOUNCE_MS)

        return () => clearTimeout(timer)
    }, [search])

    const existingIds = useMemo(() => new Set((collection.places ?? []).map((place) => place.id)), [collection.places])

    const notifyError = (error: unknown) => {
        void dispatch(Notify({ id: 'collectionAddPlacesError', message: getErrorMessage(error), type: 'error' }))
    }

    const handleAddOne = async (place: ApiModel.PlaceListItem) => {
        setPendingId(place.id)
        const result = await addPlaces({ id: collection.id, placeIds: [place.id] })
        setPendingId(null)

        if ('error' in result) {
            notifyError(result.error)
            return
        }

        void dispatch(
            Notify({
                id: 'collectionPlaceAdded',
                title: '',
                message: t('collections_place-added', { defaultValue: 'Место добавлено в коллекцию' }),
                place: { id: place.id, slug: place.slug, title: place.title, cover: place.cover },
                type: 'success'
            })
        )
    }

    const withoutExisting = (items?: ApiModel.PlaceListItem[]) => items?.filter((place) => !existingIds.has(place.id))

    const searchNew = withoutExisting(searchData?.items)
    const recommendedNew = withoutExisting(recommendedData?.items) ?? []

    const handleAddAll = async () => {
        if (!recommendedNew.length) {
            return
        }

        const result = await addPlaces({ id: collection.id, placeIds: recommendedNew.map((place) => place.id) })

        if ('error' in result) {
            notifyError(result.error)
            return
        }

        void dispatch(
            Notify({
                id: 'collectionPlacesAdded',
                title: '',
                message: t('collections_places-added', {
                    count: recommendedNew.length,
                    defaultValue: 'Добавлено мест: {{count}}'
                }),
                type: 'success'
            })
        )
    }

    const renderEmpty = (text: string, hint?: string) => (
        <div className={collectionPickerStyles.pickerEmpty}>
            <span>{text}</span>
            {hint && <span>{hint}</span>}
        </div>
    )

    const renderRows = (
        items: ApiModel.PlaceListItem[] | undefined,
        loading: boolean,
        fetching: boolean,
        emptyText: string
    ) => {
        if (loading) {
            return (
                <ul className={collectionPickerStyles.pickerList}>
                    {Array(4)
                        .fill('')
                        .map((_, i) => (
                            <RowLoader key={i} />
                        ))}
                </ul>
            )
        }

        if (!items?.length) {
            return renderEmpty(emptyText)
        }

        return (
            <ul
                className={cn(collectionPickerStyles.pickerList, fetching && collectionPickerStyles.pickerListFetching)}
                aria-busy={fetching || undefined}
            >
                {items.map((place) => {
                    const address = addressToString(place.address)
                        ?.map((item) => item.name)
                        .join(', ')

                    return (
                        <li
                            key={place.id}
                            className={cn(collectionPickerStyles.pickerRow, collectionPickerStyles.pickerRowStatic)}
                        >
                            <div className={collectionPickerStyles.pickerCover}>
                                {place.cover ? (
                                    <Image
                                        src={`${IMG_HOST}${place.cover.preview}`}
                                        alt={''}
                                        fill
                                        sizes={'40px'}
                                        style={{ objectFit: 'cover' }}
                                    />
                                ) : (
                                    <Icon name={'Photo'} />
                                )}
                            </div>

                            <div className={collectionPickerStyles.pickerBody}>
                                <strong>{place.title}</strong>
                                <span>{[place.category?.title, address].filter(Boolean).join(' · ')}</span>
                            </div>

                            <Button
                                mode={'secondary'}
                                size={'small'}
                                icon={'PlusCircle'}
                                disabled={addLoading}
                                loading={pendingId === place.id}
                                label={t('collections_add-button', { defaultValue: 'Добавить' })}
                                onClick={() => void handleAddOne(place)}
                            />
                        </li>
                    )
                })}
            </ul>
        )
    }

    return (
        <Dialog
            open={open}
            title={t('collections_add-places', { defaultValue: 'Добавить места' })}
            contentClassName={collectionPickerStyles.picker}
            maxWidth={'560px'}
            onCloseDialog={onClose}
        >
            <div
                className={styles.segmented}
                role={'tablist'}
            >
                <Button
                    role={'tab'}
                    aria-selected={tab === 'search'}
                    mode={tab === 'search' ? 'primary' : 'secondary'}
                    size={'small'}
                    icon={'Search'}
                    label={t('collections_tab-search', { defaultValue: 'Поиск' })}
                    onClick={() => setTab('search')}
                />
                <Button
                    role={'tab'}
                    aria-selected={tab === 'recommended'}
                    mode={tab === 'recommended' ? 'primary' : 'secondary'}
                    size={'small'}
                    icon={'Lightning'}
                    label={t('collections_tab-recommended', { defaultValue: 'Рекомендуем' })}
                    onClick={() => setTab('recommended')}
                />
            </div>

            {tab === 'search' && (
                <>
                    <Input
                        autoFocus
                        className={collectionPickerStyles.pickerSearch}
                        size={'medium'}
                        clearable
                        placeholder={t('collections_search-places-placeholder', {
                            defaultValue: 'Начните вводить название места'
                        })}
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />

                    <div className={collectionPickerStyles.pickerResults}>
                        {canSearch
                            ? renderRows(
                                  searchNew,
                                  searchLoading,
                                  searchFetching,
                                  t('nothing-found', { defaultValue: 'Ничего не найдено' })
                              )
                            : renderEmpty(
                                  t('collections_search-hint', { defaultValue: 'Введите не менее 2 символов' })
                              )}
                    </div>
                </>
            )}

            {tab === 'recommended' && (
                <>
                    <div className={collectionPickerStyles.pickerResults}>
                        {hasRegion
                            ? renderRows(
                                  recommendedNew,
                                  recommendedLoading,
                                  recommendedFetching,
                                  t('collections_recommended-empty', { defaultValue: 'Пока нечего порекомендовать' })
                              )
                            : renderEmpty(
                                  t('collections_recommended-empty', { defaultValue: 'Пока нечего порекомендовать' }),
                                  t('collections_recommended-no-theme', {
                                      defaultValue: 'Укажите регион в настройках, и здесь появятся подсказки'
                                  })
                              )}
                    </div>

                    {recommendedNew.length > 1 && (
                        <div className={cn(collectionPickerStyles.pickerFooter, styles.dialogActions)}>
                            <Button
                                mode={'primary'}
                                size={'medium'}
                                disabled={addLoading}
                                loading={addLoading && !pendingId}
                                label={t('collections_add-all-button', {
                                    count: recommendedNew.length,
                                    defaultValue: 'Добавить все ({{count}})'
                                })}
                                onClick={() => void handleAddAll()}
                            />
                        </div>
                    )}
                </>
            )}
        </Dialog>
    )
}
