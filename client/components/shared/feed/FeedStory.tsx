import React from 'react'
import { cn, Icon } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { AchievementIcon } from '@/components/shared/achievement-icon'
import { CollectionCard } from '@/components/shared/collection-card'
import { LevelBadge } from '@/components/shared/level-badge/LevelBadge'
import { PlaceCard } from '@/components/shared/place-card'
import { UserAvatar } from '@/components/shared/user-avatar'
import { buildCollectionUrl, formatDate, removeMarkdown, timeAgo } from '@/utils/helpers'

import { FeedPhotoMosaic } from './FeedPhotoMosaic'

import styles from './styles.module.sass'

export type FeedDensity = 'full' | 'compact'

export interface FeedStoryProps {
    story: ApiModel.FeedStory
    /** `full` — the feed page and the profile; `compact` — a narrow column (home page): smaller media */
    density?: FeedDensity
    /** The place history: the place is the page itself, so it is not attached to the stories */
    hidePlace?: boolean
}

/** Places of a multi-place story shown before "and N more" */
const PLACES_SHOWN: Record<FeedDensity, number> = { compact: 2, full: 3 }

/** The author's score in a rating story: five read-only stars */
const ScoreStars: React.FC<{ value: number }> = ({ value }) => {
    const { t } = useTranslation()

    return (
        <span
            className={styles.score}
            role={'img'}
            aria-label={t('feed-score', { value, defaultValue: 'Оценка: {{value}} из 5' })}
        >
            {[1, 2, 3, 4, 5].map((star) => (
                <Icon
                    key={star}
                    name={star <= value ? 'StarFilled' : 'StarEmpty'}
                    className={cn(styles.star, star <= value && styles.starFilled)}
                />
            ))}
        </span>
    )
}

/**
 * One card of the activity feed. Every story has the same head — who, what, when — and a
 * body that depends on its kind: a new place shows the place card and its photos, a photo
 * story a mosaic, a review its text, ratings and visits the places, a collection its card,
 * an achievement its badge. Compact stories (edits, ratings, visits) stay small, so the
 * feed reads as a rhythm of big events with the small ones in between.
 */
export const FeedStory: React.FC<FeedStoryProps> = ({ story, density = 'full', hidePlace }) => {
    const { t, i18n } = useTranslation()

    const isCompact = density === 'compact'
    const placesCount = story.placesCount ?? story.places?.length ?? 0
    const photosCount = story.photosCount ?? story.photos?.length ?? 0

    const actionText = (() => {
        switch (story.type) {
            case ApiModel.FeedStoryTypes.Place:
                return t('feed-action-place', { defaultValue: '— новое место' })
            case ApiModel.FeedStoryTypes.Photo:
                return t('feed-action-photo', { count: photosCount, defaultValue: '— {{count}} новых фото' })
            case ApiModel.FeedStoryTypes.PhotoLink:
                return t('feed-action-photo-link', { count: photosCount, defaultValue: '— привязано фото: {{count}}' })
            case ApiModel.FeedStoryTypes.Edit:
                if (story.changes?.length === 2) {
                    return t('feed-action-edit-both', { defaultValue: '— правка описания и обложки' })
                }
                return story.changes?.[0] === 'cover'
                    ? t('feed-action-edit-cover', { defaultValue: '— новая обложка' })
                    : t('feed-action-edit-description', { defaultValue: '— правка описания' })
            case ApiModel.FeedStoryTypes.Comment:
                return t('feed-action-comment', { defaultValue: '— отзыв' })
            case ApiModel.FeedStoryTypes.Rating:
                return placesCount > 1
                    ? t('feed-action-rating', { count: placesCount, defaultValue: '— оценки: {{count}} мест' })
                    : t('feed-action-rating-single', { defaultValue: '— оценка места' })
            case ApiModel.FeedStoryTypes.Visit:
                return placesCount > 1
                    ? t('feed-action-visit', { count: placesCount, defaultValue: '— посещения: {{count}} мест' })
                    : t('feed-action-visit-single', { defaultValue: '— посещение' })
            case ApiModel.FeedStoryTypes.Collection:
                return t('feed-action-collection', { defaultValue: '— новая коллекция' })
            case ApiModel.FeedStoryTypes.CollectionPlace:
                return t('feed-action-collection-place', {
                    count: placesCount,
                    defaultValue: '— {{count}} новых мест в коллекции'
                })
            case ApiModel.FeedStoryTypes.Achievement:
                return t('feed-action-achievement', { defaultValue: '— новое достижение' })
            case ApiModel.FeedStoryTypes.Level:
                return t('feed-action-level', { defaultValue: '— новый уровень' })
        }
    })()

    const authorName = story.author?.name ?? t('feed-guests', { defaultValue: 'Гости' })

    // In the place history a rating has one place, the page's own: its stars go into the head
    const inlineScore =
        hidePlace && story.type === ApiModel.FeedStoryTypes.Rating && story.places?.[0]?.value
            ? story.places[0].value
            : undefined

    const placeRow = (place?: ApiModel.PlaceListItem, footer?: React.ReactNode) =>
        place && !hidePlace ? (
            <PlaceCard
                place={place}
                variant={'row'}
                size={'small'}
                headingLevel={3}
                footer={footer}
                className={styles.place}
            />
        ) : null

    const placeList = () => {
        if (hidePlace || !story.places?.length) {
            return null
        }

        const shown = story.places.slice(0, PLACES_SHOWN[density])
        const more = placesCount - shown.length

        return (
            <div className={styles.places}>
                {shown.map((place) => (
                    <React.Fragment key={place.id}>
                        {placeRow(place, place.value ? <ScoreStars value={place.value} /> : undefined)}
                    </React.Fragment>
                ))}

                {more > 0 && (
                    <div className={styles.more}>
                        {t('feed-more-places', { count: more, defaultValue: 'и ещё {{count}}' })}
                    </div>
                )}
            </div>
        )
    }

    const body = (() => {
        switch (story.type) {
            case ApiModel.FeedStoryTypes.Place:
                return (
                    <>
                        {!hidePlace &&
                            story.place &&
                            (isCompact ? (
                                placeRow(story.place)
                            ) : (
                                <PlaceCard
                                    place={story.place}
                                    headingLevel={3}
                                    sizes={'(max-width: 1024px) 100vw, 920px'}
                                    className={styles.placeTile}
                                />
                            ))}

                        {/* A tile has no text: the description goes under it (a row has its own two lines) */}
                        {!isCompact && !hidePlace && story.place?.content && (
                            <p className={styles.excerpt}>{removeMarkdown(story.place.content)}</p>
                        )}

                        {!!story.photos?.length && (hidePlace || photosCount > 1) && (
                            <FeedPhotoMosaic
                                photos={story.photos}
                                total={photosCount}
                                density={density}
                                placeTitle={story.place?.title}
                            />
                        )}
                    </>
                )

            case ApiModel.FeedStoryTypes.Photo:
            case ApiModel.FeedStoryTypes.PhotoLink:
                return (
                    <>
                        {!!story.photos?.length && (
                            <FeedPhotoMosaic
                                photos={story.photos}
                                total={photosCount}
                                density={density}
                                placeTitle={story.place?.title}
                            />
                        )}
                        {placeRow(story.place)}
                    </>
                )

            case ApiModel.FeedStoryTypes.Comment:
                return (
                    <>
                        {story.comment?.content && (
                            <blockquote className={styles.quote}>
                                {/* The clamp is on the text, the padding on the quote: on one element the
                                    next line shows through the bottom padding, cut in half */}
                                <p className={styles.quoteText}>{story.comment.content.trim()}</p>
                            </blockquote>
                        )}
                        {placeRow(story.place)}
                    </>
                )

            case ApiModel.FeedStoryTypes.Edit:
                return placeRow(story.place)

            case ApiModel.FeedStoryTypes.Rating:
            case ApiModel.FeedStoryTypes.Visit:
            case ApiModel.FeedStoryTypes.CollectionPlace:
                return placeList()

            case ApiModel.FeedStoryTypes.Collection:
                return story.collection ? (
                    <div className={styles.collection}>
                        <CollectionCard
                            collection={story.collection}
                            showAuthor={false}
                            headingLevel={3}
                        />
                    </div>
                ) : null

            case ApiModel.FeedStoryTypes.Achievement:
                return story.achievement && story.author ? (
                    <Link
                        href={`/users/${story.author.id}/achievements`}
                        className={styles.award}
                    >
                        <AchievementIcon
                            image={story.achievement.image}
                            alt={story.achievement.title}
                            size={48}
                        />
                        <span className={styles.awardText}>
                            <span className={styles.awardTitle}>{story.achievement.title}</span>
                            {story.achievement.tier !== 'none' && (
                                <span className={cn(styles.tier, styles[`tier-${story.achievement.tier}`])}>
                                    {t(`achievements-tier-${story.achievement.tier}`)}
                                </span>
                            )}
                        </span>
                    </Link>
                ) : null

            case ApiModel.FeedStoryTypes.Level:
                return story.level ? (
                    <div className={styles.award}>
                        <LevelBadge
                            level={story.level}
                            size={36}
                        />
                        <span className={styles.awardText}>
                            <span className={styles.awardTitle}>
                                {t('feed-level', { level: story.level, defaultValue: 'Уровень {{level}}' })}
                            </span>
                        </span>
                    </div>
                ) : null
        }

        return null
    })()

    return (
        <article
            className={cn(styles.story, story.weight === 1 && styles.minor, isCompact && styles.compact)}
            data-type={story.type}
        >
            <header className={styles.head}>
                <UserAvatar
                    className={styles.avatar}
                    user={story.author ?? { id: '', name: authorName }}
                    // The head is always two lines (who and what, then when): the avatar matches their height
                    size={'medium'}
                    hideOnlineIcon={true}
                />

                <div className={styles.headline}>
                    <p className={styles.line}>
                        {story.author ? (
                            <Link
                                href={`/users/${story.author.id}`}
                                className={styles.author}
                            >
                                {story.author.name}
                            </Link>
                        ) : (
                            <span className={styles.author}>{authorName}</span>
                        )}{' '}
                        <span className={styles.action}>{actionText}</span>
                        {story.type === ApiModel.FeedStoryTypes.CollectionPlace && story.collection && (
                            <>
                                {' '}
                                <Link
                                    href={buildCollectionUrl(story.collection.id, story.collection.slug)}
                                    className={styles.subject}
                                >
                                    {story.collection.title}
                                </Link>
                            </>
                        )}
                        {inlineScore && (
                            <>
                                {' '}
                                <ScoreStars value={inlineScore} />
                            </>
                        )}
                    </p>

                    <time
                        className={styles.time}
                        // "5 minutes ago" may have become "6" between the server render and hydration
                        suppressHydrationWarning={true}
                        dateTime={story.updated?.date}
                        title={formatDate(
                            story.updated?.date,
                            t('date-time-format', { defaultValue: 'D MMMM YYYY, HH:mm' })
                        )}
                    >
                        {timeAgo(story.updated?.date, false, i18n.language)}
                    </time>
                </div>
            </header>

            {body && <div className={styles.body}>{body}</div>}
        </article>
    )
}
