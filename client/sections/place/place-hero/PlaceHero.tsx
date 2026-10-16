import React, { useMemo } from 'react'
import { Icon } from 'simple-react-ui-kit'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel, ApiType } from '@/api'
import { useAppSelector } from '@/app/store'
import { Breadcrumbs } from '@/components/ui'
import { categoryImage, getCategoryTitle } from '@/utils/categories'
import {
    addDecimalPoint,
    buildCategoryHref,
    buildPlacesHref,
    dateToUnixTime,
    formatThousands,
    getLandingFlags
} from '@/utils/helpers'

import { PlaceCover } from './PlaceCover'

import styles from './styles.module.sass'

interface PlaceHeroProps {
    place?: ApiModel.Place
    photos?: ApiModel.Photo[]
    coverHash?: number
    /** The desktop actions toolbar on the title's line (`PlaceActions`); phones have the bottom bar */
    actions?: React.ReactNode
    onPhotoUploadClick?: (event?: React.MouseEvent) => void
    onAllPhotosClick?: () => void
    onPhotoClick?: (index: number) => void
}

/** Anchor of the ratings and reviews block (`PlaceReviews`): the rating and reviews facts scroll there */
export const REVIEWS_ANCHOR = 'reviews'

/** Anchor of the reader's own score in that block: "Оценок пока нет" scrolls straight to the stars */
export const RATE_ANCHOR = 'rate'

const addressTypes: ApiType.LocationTypes[] = ['country', 'region', 'district', 'locality']

/**
 * The hero of the place page answers "what is it and where": the breadcrumbs, the picture
 * (`PlaceCover`: the clean cover, a carousel of every photo on phones), then on the page
 * background the h1 and one line of facts — the category (a link to its places), the rating
 * and the reviews (links to the reviews block), the distance — with the actions on the
 * title's line. The address and the coordinates live in the "Где это" card, the views in
 * "О месте".
 */
export const PlaceHero: React.FC<PlaceHeroProps> = ({
    place,
    photos,
    coverHash,
    actions,
    onPhotoUploadClick,
    onAllPhotosClick,
    onPhotoClick
}) => {
    const { t } = useTranslation()

    const userId = useAppSelector((state) => state.auth.user?.id)
    const { data: ratingData } = API.useRatingGetListQuery(place?.id ?? '', { skip: !place?.id })
    // Prefetched on the server with the page
    const { data: commentsData } = API.useCommentsGetListQuery({ place: place?.id }, { skip: !place?.id })

    const coverHashString = coverHash || dateToUnixTime(place?.updated?.date)
    const landingFlags = getLandingFlags()

    // The most specific level of the address with an id: the breadcrumb pairs it with the category
    const mostSpecificAddress = useMemo(
        () =>
            [...addressTypes]
                .reverse()
                .map((type) => ({ type, item: place?.address?.[type] }))
                .find(({ item }) => !!item?.id),
        [place?.address]
    )

    const ratingValue = ratingData?.rating ?? place?.rating
    const ratingCount = ratingData?.count ?? 0
    const commentsCount = commentsData?.items?.length ?? 0
    // The author cannot rate the place: the rating is a plain fact for them
    const isAuthor = !!userId && !!place?.author?.id && userId === place.author.id

    // A rated place leads to the summary, an unrated one straight to the stars
    const ratingAnchor = ratingCount ? REVIEWS_ANCHOR : RATE_ANCHOR

    const scrollTo = (anchor: string) => (event: React.MouseEvent) => {
        const target = document.getElementById(anchor)

        if (target) {
            event.preventDefault()
            target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }

    const ratingFact = ratingCount ? (
        <>
            <Icon
                name={'StarFilled'}
                className={styles.star}
            />
            <strong>{addDecimalPoint(ratingValue)}</strong>
            {` · ${t('place-votes-count', { count: ratingCount, defaultValue: '{{count}} оценок' })}`}
        </>
    ) : (
        <>
            <Icon
                name={'StarEmpty'}
                className={styles.star}
            />
            {t('place-no-votes-yet', { defaultValue: 'Оценок пока нет' })}
        </>
    )

    return (
        <header className={styles.hero}>
            <Breadcrumbs
                className={styles.breadcrumbs}
                links={[
                    { link: '/places', text: t('nav-places', { defaultValue: 'Места' }) },
                    ...(place?.category
                        ? [
                              {
                                  // The most specific location of the place + the category
                                  // (features/20-location-seo-pages.md) when the pair pages
                                  // exist; otherwise the plain category link, as before them.
                                  link: buildPlacesHref(
                                      {
                                          category: place.category,
                                          defaultOrder: ApiType.SortOrders.DESC,
                                          defaultSort: ApiType.SortFields.Trending,
                                          location:
                                              landingFlags.combinations && mostSpecificAddress?.item?.id
                                                  ? {
                                                        id: mostSpecificAddress.item.id,
                                                        slug: mostSpecificAddress.item.slug,
                                                        type: mostSpecificAddress.type
                                                    }
                                                  : null
                                      },
                                      landingFlags
                                  ).href,
                                  text: getCategoryTitle(t, place.category)
                              }
                          ]
                        : [])
                ]}
            />

            <PlaceCover
                place={place}
                photos={photos}
                coverHash={coverHashString}
                onPhotoUploadClick={onPhotoUploadClick}
                onAllPhotosClick={onAllPhotosClick}
                onPhotoClick={onPhotoClick}
            />

            <div className={styles.head}>
                <div className={styles.text}>
                    <h1>{place?.title}</h1>

                    {/* The dots between the facts sit on the list items, outside the links */}
                    <ul className={styles.facts}>
                        {place?.category && (
                            <li>
                                <Link
                                    href={buildCategoryHref(place.category, landingFlags)}
                                    className={styles.category}
                                    title={`${t('all-places-in-category', { defaultValue: 'Все места категории' })} ${getCategoryTitle(t, place.category)}`}
                                >
                                    <Image
                                        src={categoryImage(place.category).src}
                                        alt={''}
                                        width={18}
                                        height={18}
                                    />
                                    {getCategoryTitle(t, place.category)}
                                </Link>
                            </li>
                        )}

                        <li>
                            {isAuthor ? (
                                <span className={styles.fact}>{ratingFact}</span>
                            ) : (
                                <a
                                    href={`#${ratingAnchor}`}
                                    className={styles.fact}
                                    onClick={scrollTo(ratingAnchor)}
                                >
                                    {ratingFact}
                                </a>
                            )}
                        </li>

                        <li>
                            <a
                                href={`#${REVIEWS_ANCHOR}`}
                                className={styles.fact}
                                onClick={scrollTo(REVIEWS_ANCHOR)}
                            >
                                {commentsCount
                                    ? t('place-reviews-count', {
                                          count: commentsCount,
                                          defaultValue: '{{count}} отзывов'
                                      })
                                    : t('place-no-reviews-yet', { defaultValue: 'Отзывов пока нет' })}
                            </a>
                        </li>

                        {!!place?.distance && (
                            <li>
                                <span className={styles.fact}>
                                    <Icon name={'Point'} />
                                    {t('distance-from-you', {
                                        distance: formatThousands(place.distance),
                                        defaultValue: '{{distance}} км от вас'
                                    })}
                                </span>
                            </li>
                        )}
                    </ul>
                </div>

                {actions && <div className={styles.actions}>{actions}</div>}
            </div>
        </header>
    )
}
