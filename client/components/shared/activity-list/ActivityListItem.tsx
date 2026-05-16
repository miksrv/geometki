import React, { useState } from 'react'
import { cn, Icon } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { PhotoLightbox, Rating, UserAvatar } from '@/components/shared'
import { IMG_HOST } from '@/config/env'
import { formatDate, removeMarkdown, timeAgo } from '@/utils/helpers'

import styles from './styles.module.sass'

interface ActivityListItemProps {
    item: ApiModel.Activity
    compact?: boolean
}

export const ActivityListItem: React.FC<ActivityListItemProps> = ({ item, compact }) => {
    const { t, i18n } = useTranslation('components.activity-list')

    const [showLightbox, setShowLightbox] = useState<boolean>(false)
    const [photoIndex, setPhotoIndex] = useState<number>()

    const actionText = {
        [ApiModel.ActivityTypes.Comment]: t('activity-comment', { defaultValue: 'прокомментировал(-а) место' }),
        [ApiModel.ActivityTypes.Cover]: t('activity-cover', { defaultValue: 'обновил(-а) обложку' }),
        [ApiModel.ActivityTypes.Edit]: t('activity-editing', { defaultValue: 'отредактировал(-а) место' }),
        [ApiModel.ActivityTypes.Place]: t('activity-new-place', { defaultValue: 'добавил(-а) место' }),
        [ApiModel.ActivityTypes.Photo]: t('activity-uploading-photo', { defaultValue: 'загрузил(-а) фото' }),
        [ApiModel.ActivityTypes.Rating]: t('activity-rating', { defaultValue: 'оценил(-а) место' }),
        [ApiModel.ActivityTypes.Visit]: t('activity-visit', { defaultValue: 'посетил(-а) место' })
    }[item.type]

    const coverPreview = item.place?.cover?.preview
    const showCoverInGrid = !item.photos?.length && item.type !== ApiModel.ActivityTypes.Photo && !!coverPreview

    const hasPhotos = !!item.photos?.length
    const extraCount = hasPhotos ? Math.max(0, item.photos!.length - 3) : 0
    const visiblePhotos = hasPhotos ? item.photos!.slice(0, 3) : []

    const header = (
        <div className={styles.header}>
            <UserAvatar
                className={styles.userAvatar}
                size={'medium'}
                user={item.author}
            />
            <div className={styles.meta}>
                <div className={styles.metaLine}>
                    {item.author?.id ? (
                        <Link
                            href={`/users/${item.author.id}`}
                            className={styles.authorName}
                            title={item.author.name}
                        >
                            {item.author.name}
                        </Link>
                    ) : (
                        <span className={styles.authorName}>{t('guest-user', { defaultValue: 'Гость' })}</span>
                    )}
                    {actionText && <span className={styles.actionText}>{actionText}</span>}
                </div>
                <time
                    className={styles.time}
                    dateTime={item.created?.date}
                    title={formatDate(
                        item.created?.date,
                        t('date_time_format', { defaultValue: 'D MMMM YYYY, HH:mm' })
                    )}
                >
                    {timeAgo(item.created?.date, false, i18n.language)}
                </time>
            </div>
        </div>
    )

    const rating = item.rating?.value ? (
        <Rating
            className={styles.rating}
            value={item.rating.value}
            voted={true}
            disabled={true}
        />
    ) : null

    const bottomBar = (
        <div className={styles.bottomBar}>
            <Link
                href={`/places/${item.place?.id}`}
                title={item.place?.title}
                className={styles.pointLink}
            >
                {item.place?.title}
            </Link>

            {!compact && !!item.views && (
                <div className={styles.viewCounter}>
                    <Icon name={'Eye'} />
                    {item.views}
                </div>
            )}
        </div>
    )

    if (compact) {
        const showCompactPhotos = hasPhotos || showCoverInGrid

        return (
            <div className={cn(styles.activityItem, styles.compact)}>
                <div className={styles.compactLeft}>
                    {header}
                    {rating}
                    {bottomBar}
                </div>

                {showCompactPhotos && (
                    <div className={styles.compactRight}>
                        {hasPhotos ? (
                            <>
                                {visiblePhotos.map((photo, i) => (
                                    <button
                                        key={i}
                                        className={styles.photoThumbBtn}
                                        onClick={() => {
                                            setPhotoIndex(i)
                                            setShowLightbox(true)
                                        }}
                                        aria-label={`${t('photo', { defaultValue: 'Фото' })} ${i + 1}`}
                                    >
                                        <img
                                            src={`${IMG_HOST}${photo.preview}`}
                                            alt={''}
                                            className={styles.photoThumb}
                                        />
                                        {i === 2 && extraCount > 0 && (
                                            <div className={styles.photoOverlay}>+{extraCount}</div>
                                        )}
                                    </button>
                                ))}

                                <PhotoLightbox
                                    photos={item.photos}
                                    photoIndex={photoIndex}
                                    showLightbox={showLightbox}
                                    onCloseLightBox={() => setShowLightbox(false)}
                                />
                            </>
                        ) : (
                            <Link
                                href={`/places/${item.place?.id}`}
                                className={styles.photoThumbBtn}
                                title={item.place?.title}
                            >
                                <img
                                    src={`${IMG_HOST}${coverPreview}`}
                                    alt={item.place?.title ?? ''}
                                    className={styles.photoThumb}
                                    onError={(e) => {
                                        e.currentTarget.parentElement?.setAttribute('style', 'display:none')
                                    }}
                                />
                            </Link>
                        )}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className={styles.activityItem}>
            {header}

            {(item.type === ApiModel.ActivityTypes.Place || item.type === ApiModel.ActivityTypes.Edit) &&
                item.place?.content && (
                    <p className={styles.content}>
                        {removeMarkdown(item.place.content)}
                        {item.place.content.length >= 500 ? '…' : ''}
                    </p>
                )}

            {item.type === ApiModel.ActivityTypes.Comment && item.comment?.content && (
                <div className={'placeContent'}>
                    <blockquote>{item.comment.content}</blockquote>
                </div>
            )}

            {rating}

            {hasPhotos && (
                <>
                    <div className={styles.photosGrid}>
                        {item.photos!.map((photo, i) => (
                            <button
                                key={i}
                                className={styles.photoThumbBtn}
                                onClick={() => {
                                    setPhotoIndex(i)
                                    setShowLightbox(true)
                                }}
                                aria-label={`${t('photo', { defaultValue: 'Фото' })} ${i + 1}`}
                            >
                                <img
                                    src={`${IMG_HOST}${photo.preview}`}
                                    alt={''}
                                    className={styles.photoThumb}
                                />
                            </button>
                        ))}
                    </div>

                    <PhotoLightbox
                        photos={item.photos}
                        photoIndex={photoIndex}
                        showLightbox={showLightbox}
                        onCloseLightBox={() => setShowLightbox(false)}
                    />
                </>
            )}

            {showCoverInGrid && coverPreview && (
                <div className={styles.photosGrid}>
                    <Link
                        href={`/places/${item.place?.id}`}
                        className={styles.photoThumbBtn}
                        title={item.place?.title}
                    >
                        <img
                            src={`${IMG_HOST}${coverPreview}`}
                            alt={item.place?.title ?? ''}
                            className={styles.photoThumb}
                            onError={(e) => {
                                e.currentTarget.closest('div')!.style.display = 'none'
                            }}
                        />
                    </Link>
                </div>
            )}

            {bottomBar}
        </div>
    )
}
