import React from 'react'
import { Button, Icon, Popout } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { PageHeader, UserAvatar } from '@/components/shared'
import { timeAgo } from '@/utils/helpers'

import styles from '../styles.module.sass'

interface CollectionHeaderProps {
    collection?: ApiModel.Collection
    /** Owner controls: "Редактировать" (or "Готово" / "Отмена" in edit mode) and the settings/delete menu */
    isOwner?: boolean
    editMode?: boolean
    /** "Готово" is saving the page's pending edits */
    saving?: boolean
    onEdit?: () => void
    /** Confirms all edits made in edit mode and leaves it */
    onDone?: () => void
    /** Discards pending edits and leaves edit mode */
    onCancel?: () => void
    onOpenSettings?: () => void
    onDelete?: () => void
}

/**
 * Article-style header of the collection page: breadcrumbs, the title and a byline with
 * the author, the number of places, the region and the last update. There is no cover on
 * purpose — the map below is the visual of a collection (see DESIGN.md).
 */
export const CollectionHeader: React.FC<CollectionHeaderProps> = ({
    collection,
    isOwner,
    editMode,
    saving,
    onEdit,
    onDone,
    onCancel,
    onOpenSettings,
    onDelete
}) => {
    const { t, i18n } = useTranslation()

    const byline = collection && (
        <div className={styles.byline}>
            <UserAvatar
                size={'small'}
                showName={true}
                user={{
                    id: collection.author.id,
                    name: collection.author.name,
                    avatar: collection.author.avatar ?? undefined
                }}
            />
            <span
                className={styles.bylineDot}
                aria-hidden={true}
            >
                {'·'}
            </span>
            <span>
                {t('collections_places-count', {
                    count: collection.placesCount ?? 0,
                    defaultValue: '{{count}} мест'
                })}
            </span>
            {collection.region && (
                <>
                    <span
                        className={styles.bylineDot}
                        aria-hidden={true}
                    >
                        {'·'}
                    </span>
                    <Link
                        href={`/collections?region=${collection.region.id}`}
                        title={collection.region.name}
                    >
                        {collection.region.name}
                    </Link>
                </>
            )}
            {collection.updated?.date && (
                <>
                    <span
                        className={styles.bylineDot}
                        aria-hidden={true}
                    >
                        {'·'}
                    </span>
                    <span>
                        {t('collections_updated-ago', {
                            defaultValue: 'обновлено {{ago}}',
                            ago: timeAgo(collection.updated.date, undefined, i18n.language)
                        })}
                    </span>
                </>
            )}
        </div>
    )

    return (
        <PageHeader
            title={collection?.title}
            breadcrumbs={[{ link: '/collections', text: t('nav-collections', { defaultValue: 'Коллекции' }) }]}
            description={byline}
            actions={
                isOwner ? (
                    <>
                        {editMode ? (
                            <>
                                <Button
                                    size={'medium'}
                                    mode={'secondary'}
                                    disabled={saving}
                                    label={t('cancel')}
                                    onClick={onCancel}
                                />
                                <Button
                                    size={'medium'}
                                    mode={'primary'}
                                    icon={'CheckCircle'}
                                    loading={saving}
                                    disabled={saving}
                                    label={t('collections_done-editing', { defaultValue: 'Готово' })}
                                    onClick={onDone}
                                />
                            </>
                        ) : (
                            <Button
                                size={'medium'}
                                mode={'secondary'}
                                icon={'Pencil'}
                                label={t('collections_edit-button', { defaultValue: 'Редактировать' })}
                                onClick={onEdit}
                            />
                        )}
                        <Popout
                            closeOnChildrenClick={true}
                            trigger={
                                <Button
                                    icon={'VerticalDots'}
                                    size={'medium'}
                                    mode={'secondary'}
                                    aria-label={t('collections_menu', { defaultValue: 'Действия с коллекцией' })}
                                />
                            }
                        >
                            <ul className={'contextListMenu'}>
                                <li>
                                    <Link
                                        href={'#'}
                                        onClick={(event) => {
                                            event.preventDefault()
                                            onOpenSettings?.()
                                        }}
                                    >
                                        {}
                                        <Icon name={'Settings'} />
                                        {t('collections_settings', { defaultValue: 'Настройки коллекции' })}
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        href={'#'}
                                        onClick={(event) => {
                                            event.preventDefault()
                                            onDelete?.()
                                        }}
                                    >
                                        {}
                                        <Icon name={'Close'} />
                                        {t('collections_delete-collection', { defaultValue: 'Удалить коллекцию' })}
                                    </Link>
                                </li>
                            </ul>
                        </Popout>
                    </>
                ) : undefined
            }
        />
    )
}
