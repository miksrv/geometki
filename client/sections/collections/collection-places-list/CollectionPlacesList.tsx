import React, { useState } from 'react'
import { Button } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { EmptyState } from '@/components/shared'
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog'
import { MediaTileGrid } from '@/components/shared/media-tile'
import { PlaceCard } from '@/components/shared/place-card'

import styles from '../styles.module.sass'

interface CollectionPlacesListProps {
    places: ApiModel.CollectionPlace[]
    /** Owner edit mode: per-row move/remove controls */
    editable?: boolean
    /** Owner: gets the "add places" call to action after the list and in the empty state */
    canAdd?: boolean
    onRemove?: (placeId: string) => void
    onReorder?: (order: string[]) => void
    onAddPlaces?: () => void
}

/**
 * The places of a collection as the usual tile grid in the author's order. Readers see
 * the same tiles as on every place list; the owner in edit mode gets move and remove
 * controls over the top-right corner of each tile.
 */
export const CollectionPlacesList: React.FC<CollectionPlacesListProps> = ({
    places,
    editable,
    canAdd,
    onRemove,
    onReorder,
    onAddPlaces
}) => {
    const { t } = useTranslation()

    const [removeCandidate, setRemoveCandidate] = useState<ApiModel.CollectionPlace | null>(null)

    const isOwner = editable || canAdd

    const handleConfirmRemove = () => {
        if (removeCandidate) {
            onRemove?.(removeCandidate.id)
        }
        setRemoveCandidate(null)
    }

    const handleMove = (index: number, direction: -1 | 1) => {
        const targetIndex = index + direction

        if (targetIndex < 0 || targetIndex >= places.length) {
            return
        }

        const order = places.map((place) => place.id)
        const [moved] = order.splice(index, 1)
        order.splice(targetIndex, 0, moved)
        onReorder?.(order)
    }

    if (!places.length) {
        return (
            <EmptyState
                title={t('collections_no-places-title', { defaultValue: 'В коллекции пока нет мест' })}
                description={
                    isOwner
                        ? t('collections_no-places-owner', {
                              defaultValue: 'Добавьте первое место — через поиск или из рекомендаций по теме'
                          })
                        : t('collections_no-places-reader', {
                              defaultValue: 'Автор ещё собирает подборку, загляните позже'
                          })
                }
                action={
                    isOwner ? (
                        <Button
                            mode={'primary'}
                            size={'medium'}
                            icon={'PlusCircle'}
                            label={t('collections_add-places', { defaultValue: 'Добавить места' })}
                            onClick={onAddPlaces}
                        />
                    ) : undefined
                }
            />
        )
    }

    return (
        <>
            <MediaTileGrid>
                {places.map((place, index) => (
                    <PlaceCard
                        key={place.id}
                        place={place}
                        actions={
                            editable ? (
                                <div
                                    role={'group'}
                                    aria-label={place.title}
                                    className={styles.placeActions}
                                >
                                    <Button
                                        mode={'secondary'}
                                        size={'small'}
                                        icon={'KeyboardLeft'}
                                        disabled={index === 0}
                                        tooltip={t('collections_move-up', { defaultValue: 'Переместить раньше' })}
                                        onClick={() => handleMove(index, -1)}
                                    />
                                    <Button
                                        mode={'secondary'}
                                        size={'small'}
                                        icon={'KeyboardRight'}
                                        disabled={index === places.length - 1}
                                        tooltip={t('collections_move-down', { defaultValue: 'Переместить позже' })}
                                        onClick={() => handleMove(index, 1)}
                                    />
                                    <Button
                                        mode={'secondary'}
                                        size={'small'}
                                        icon={'Close'}
                                        className={styles.placeItemRemove}
                                        tooltip={t('collections_remove-place', {
                                            defaultValue: 'Удалить из коллекции'
                                        })}
                                        onClick={() => setRemoveCandidate(place)}
                                    />
                                </div>
                            ) : undefined
                        }
                    />
                ))}
            </MediaTileGrid>

            {isOwner && (
                <div className={styles.placesFooter}>
                    <Button
                        mode={'secondary'}
                        size={'medium'}
                        stretched={true}
                        icon={'PlusCircle'}
                        label={t('collections_add-places', { defaultValue: 'Добавить места' })}
                        onClick={onAddPlaces}
                    />
                </div>
            )}

            <ConfirmationDialog
                open={!!removeCandidate}
                message={t('collections_remove-place-confirm', {
                    defaultValue: 'Удалить «{{title}}» из коллекции?',
                    title: removeCandidate?.title ?? ''
                })}
                confirmLabel={t('collections_remove-place-short', { defaultValue: 'Удалить' })}
                onConfirm={handleConfirmRemove}
                onCancel={() => setRemoveCandidate(null)}
            />
        </>
    )
}
