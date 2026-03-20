import React, { useState } from 'react'
import PhotoAlbum from 'react-photo-album'
import { cn, Container, Icon } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTranslation } from 'next-i18next'

import { ApiModel } from '@/api'
import { IMG_HOST } from '@/config/env'
import { PhotoLightbox, Rating, UserAvatar } from '@/components/shared'
import { ReadMore } from '@/components/ui'
import { formatDate } from '@/utils/helpers'

import 'react-photo-album/rows.css'
import styles from './styles.module.sass'

interface ActivityListItemProps {
    item: ApiModel.Activity
    title?: string
}

export const ActivityListItem: React.FC<ActivityListItemProps> = ({ item, title }) => {
    const { t } = useTranslation('components.activity-list')

    const [showLightbox, setShowLightbox] = useState<boolean>(false)
    const [photoIndex, setPhotoIndex] = useState<number>()

    const handleCloseLightbox = () => {
        setShowLightbox(false)
    }

    const handlePhotoClick = (index: number) => {
        setPhotoIndex(index)
        setShowLightbox(true)
    }

    return (
        <Container
            title={title}
            className={styles.activityContainer}
        >
            <UserAvatar
                className={styles.userAvatar}
                size={'medium'}
                user={item.author}
                showName={true}
                caption={
                    <>
                        {formatDate(item.created?.date, t('date_time_format', { defaultValue: 'D MMMM YYYY, HH:mm' }))}
                        {' • '}
                        {
                            {
                                [ApiModel.ActivityTypes.Comment]: t('activity-comment', {
                                    defaultValue: 'Комментировал(а) интересное место'
                                }),
                                [ApiModel.ActivityTypes.Edit]: t('activity-editing', {
                                    defaultValue: 'Редактировал(а) интересное место'
                                }),
                                [ApiModel.ActivityTypes.Place]: t('activity-new-place', {
                                    defaultValue: 'Добавил(а) новое интересное место'
                                }),
                                [ApiModel.ActivityTypes.Photo]: t('activity-uploading-photo', {
                                    defaultValue: 'Загрузил(а) фотографию к интересному месту'
                                }),
                                [ApiModel.ActivityTypes.Rating]: t('activity-rating', {
                                    defaultValue: 'Оценил(а) интересное место'
                                })
                            }[item.type]
                        }
                        {item.type === ApiModel.ActivityTypes.Edit && item.place?.difference ? (
                            <>
                                {' ('}
                                <span
                                    className={
                                        item.place.difference > 0
                                            ? styles.green
                                            : item.place.difference < 0
                                              ? styles.red
                                              : ''
                                    }
                                >
                                    {item.place.difference > 0 && '+'}
                                    {item.place.difference}
                                </span>
                                {')'}
                            </>
                        ) : (
                            ''
                        )}
                    </>
                }
            />

            {(item.type === ApiModel.ActivityTypes.Place || item.type === ApiModel.ActivityTypes.Edit) &&
                item.place?.content && (
                    <ReadMore
                        className={cn(styles.content, !!item.photos?.length && styles.contentGallery)}
                        showMoreText={t('show-more', { defaultValue: 'Показать полностью' })}
                        showLessText={t('show-less', { defaultValue: 'Скрыть' })}
                    >
                        {item.place.content}
                    </ReadMore>
                )}

            {item.type === ApiModel.ActivityTypes.Comment && item?.comment?.content && (
                <div className={'placeContent'}>
                    <blockquote>{item.comment.content}</blockquote>
                </div>
            )}

            {item?.rating?.value && (
                <Rating
                    value={item?.rating?.value}
                    voted={true}
                    disabled={true}
                />
            )}

            {!!item.photos?.length && (
                <>
                    {/*todo: https://react-photo-album.com/examples/nextjs*/}
                    <PhotoAlbum
                        layout={'rows'}
                        spacing={5}
                        photos={item.photos.map((photo) => ({
                            height: photo.height,
                            src: `${IMG_HOST}${photo.preview}`,
                            width: photo.width
                        }))}
                        onClick={({ index }) => {
                            handlePhotoClick(index)
                        }}
                    />

                    <PhotoLightbox
                        photos={item.photos}
                        photoIndex={photoIndex}
                        showLightbox={showLightbox}
                        onCloseLightBox={handleCloseLightbox}
                    />
                </>
            )}

            <div className={styles.bottomBar}>
                <Link
                    href={`/places/${item.place?.id}`}
                    title={item.place?.title}
                    className={styles.pointLink}
                >
                    {item.place?.title}
                </Link>

                {!!item.views && (
                    <div className={styles.viewCounter}>
                        <Icon name={'Eye'} />
                        {item.views || 0}
                    </div>
                )}
            </div>
        </Container>
    )
}
