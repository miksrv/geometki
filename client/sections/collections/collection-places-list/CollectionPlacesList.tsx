import React, { useState } from 'react'
import { Button, Icon, Input } from 'simple-react-ui-kit'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog'
import { IMG_HOST } from '@/config/env'
import { addressToString } from '@/utils/address'
import { haversineDistanceKm } from '@/utils/collectionFacts'
import { buildPlaceUrl } from '@/utils/helpers'

import styles from '../styles.module.sass'

interface CollectionPlacesListProps {
    places: ApiModel.CollectionPlace[]
    /** Owner edit mode: shows remove/reorder/note controls. */
    editable?: boolean
    onRemove?: (placeId: string) => void
    onReorder?: (order: string[]) => void
    onNoteChange?: (placeId: string, note: string | null) => void
}

export const CollectionPlacesList: React.FC<CollectionPlacesListProps> = ({
    places,
    editable,
    onRemove,
    onReorder,
    onNoteChange
}) => {
    const { t } = useTranslation()

    const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
    const [noteDraft, setNoteDraft] = useState('')
    const [removeCandidate, setRemoveCandidate] = useState<ApiModel.CollectionPlace | null>(null)

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

    const handleStartNote = (place: ApiModel.CollectionPlace) => {
        setEditingNoteId(place.id)
        setNoteDraft(place.note ?? '')
    }

    const handleSaveNote = (placeId: string) => {
        onNoteChange?.(placeId, noteDraft.trim() || null)
        setEditingNoteId(null)
    }

    return (
        <>
            <ol className={styles.placesList}>
                {places.map((place, index) => {
                    const distance = index > 0 ? haversineDistanceKm(places[index - 1], place) : undefined

                    return (
                        <li
                            key={place.id}
                            className={styles.placeItem}
                        >
                            <div className={styles.placeItemNumber}>{index + 1}</div>

                            <div className={styles.placeItemCover}>
                                {place.cover && (
                                    <Image
                                        src={`${IMG_HOST}${place.cover.preview}`}
                                        alt={place.title ?? ''}
                                        fill
                                        sizes={'72px'}
                                        style={{ objectFit: 'cover' }}
                                    />
                                )}
                            </div>

                            <div className={styles.placeItemBody}>
                                <Link href={buildPlaceUrl(place.id, place.slug)}>
                                    <strong>{place.title ?? place.id}</strong>
                                </Link>

                                <div className={styles.placeItemMeta}>
                                    {place.category && <span>{place.category.title}</span>}
                                    {!!addressToString(place.address)?.length && (
                                        <span>
                                            {addressToString(place.address)
                                                ?.map((a) => a.name)
                                                .join(', ')}
                                        </span>
                                    )}
                                    {!!place.rating && (
                                        <span>
                                            <Icon name={'StarEmpty'} /> {place.rating}
                                        </span>
                                    )}
                                    {distance !== undefined && (
                                        <span>
                                            {t('collections_distance-from-previous', {
                                                defaultValue: '{{km}} км от предыдущего',
                                                km: distance.toFixed(1)
                                            })}
                                        </span>
                                    )}
                                </div>

                                {editable && editingNoteId === place.id ? (
                                    <div className={styles.modalNewCollection}>
                                        <Input
                                            value={noteDraft}
                                            placeholder={t('collections_note-placeholder', {
                                                defaultValue: 'Короткая заметка об этом месте'
                                            })}
                                            onChange={(event) => setNoteDraft(event.target.value)}
                                        />
                                        <Button
                                            mode={'primary'}
                                            onClick={() => handleSaveNote(place.id)}
                                        >
                                            {t('save')}
                                        </Button>
                                    </div>
                                ) : (
                                    place.note && <p className={styles.placeItemNote}>{place.note}</p>
                                )}
                            </div>

                            {editable && (
                                <div className={styles.placeItemActions}>
                                    <Button
                                        mode={'outline'}
                                        size={'large'}
                                        icon={'KeyboardUp'}
                                        disabled={index === 0}
                                        tooltip={t('collections_move-up', { defaultValue: 'Переместить выше' })}
                                        onClick={() => handleMove(index, -1)}
                                    />
                                    <Button
                                        mode={'outline'}
                                        size={'large'}
                                        icon={'KeyboardDown'}
                                        disabled={index === places.length - 1}
                                        tooltip={t('collections_move-down', { defaultValue: 'Переместить ниже' })}
                                        onClick={() => handleMove(index, 1)}
                                    />
                                    <Button
                                        mode={'outline'}
                                        size={'large'}
                                        icon={'Pencil'}
                                        tooltip={t('collections_edit-note', { defaultValue: 'Заметка' })}
                                        onClick={() => handleStartNote(place)}
                                    />
                                    <Button
                                        mode={'outline'}
                                        size={'large'}
                                        icon={'Close'}
                                        tooltip={t('collections_remove-place', {
                                            defaultValue: 'Удалить из коллекции'
                                        })}
                                        onClick={() => setRemoveCandidate(place)}
                                    />
                                </div>
                            )}
                        </li>
                    )
                })}
            </ol>

            <ConfirmationDialog
                open={!!removeCandidate}
                message={t('collections_remove-place-confirm', {
                    defaultValue: 'Удалить «{{title}}» из коллекции?',
                    title: removeCandidate?.title ?? ''
                })}
                onConfirm={handleConfirmRemove}
                onCancel={() => setRemoveCandidate(null)}
            />
        </>
    )
}
