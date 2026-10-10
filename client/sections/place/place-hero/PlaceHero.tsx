import React, { useMemo } from 'react'
import { cn, Icon } from 'simple-react-ui-kit'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel, ApiType } from '@/api'
import { useAppSelector } from '@/app/store'
import { Breadcrumbs } from '@/components/ui'
import { IMG_HOST } from '@/config/env'
import { categoryImage, getCategoryTitle } from '@/utils/categories'
import {
    addDecimalPoint,
    buildCategoryHref,
    buildLocationHref,
    buildPlacesHref,
    dateToUnixTime,
    formatThousands,
    getLandingFlags
} from '@/utils/helpers'

import styles from './styles.module.sass'

interface PlaceHeroProps {
    place?: ApiModel.Place
    coverHash?: number
    /** The toolbar (`PlaceActions`) continues the cover below: square bottom corners */
    attached?: boolean
}

type PlaceAddress = {
    id?: number
    name?: string
    slug?: string | null
    type: ApiType.LocationTypes
}

/** Anchor of the rate prompt (`PlaceRatePrompt`): the rating in the facts line scrolls there */
export const RATE_ANCHOR = 'rate'

const addressTypes: ApiType.LocationTypes[] = ['country', 'region', 'district', 'locality']

/**
 * The hero of the place page: the cover with the breadcrumbs on its top gradient and, on
 * the bottom one, the h1, the address line and the facts line (rating · category · views ·
 * distance). Every fact is a link; the actions are the toolbar under the cover (`PlaceActions`).
 */
export const PlaceHero: React.FC<PlaceHeroProps> = ({ place, coverHash, attached }) => {
    const { t } = useTranslation()

    const userId = useAppSelector((state) => state.auth.user?.id)
    const { data: ratingData } = API.useRatingGetListQuery(place?.id ?? '', { skip: !place?.id })

    const coverHashString = coverHash || dateToUnixTime(place?.updated?.date)
    const landingFlags = getLandingFlags()

    // Country → locality, only the levels the place has
    const placeAddress = useMemo(() => {
        const address: PlaceAddress[] = []

        addressTypes.forEach((type) => {
            if (place?.address?.[type]?.id) {
                address.push({
                    id: place?.address[type]?.id,
                    name: place?.address[type]?.name,
                    slug: place?.address[type]?.slug,
                    type
                })
            }
        })

        return address
    }, [place?.address])

    // The most specific level with an id — last in `placeAddress`
    const mostSpecificAddress = [...placeAddress]
        .reverse()
        .find((item): item is PlaceAddress & { id: number } => !!item.id)

    const ratingValue = ratingData?.rating ?? place?.rating
    const ratingCount = ratingData?.count ?? 0
    // The author cannot rate the place: a plain fact for them, a link to the prompt for everyone else
    const isAuthor = !!userId && !!place?.author?.id && userId === place.author.id

    // Only the number is bold, the count after the dot is plain
    const ratingText = ratingCount ? (
        <>
            <strong>{addDecimalPoint(ratingValue)}</strong>
            {` · ${t('place-votes-count', { count: ratingCount, defaultValue: '{{count}} оценок' })}`}
        </>
    ) : (
        t('place-no-votes-yet', { defaultValue: 'Оценок пока нет' })
    )

    const handleRateClick = (event: React.MouseEvent) => {
        const target = document.getElementById(RATE_ANCHOR)

        if (target) {
            event.preventDefault()
            target.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
    }

    return (
        <section className={cn(styles.hero, attached && styles.attached)}>
            {place?.cover && (
                <Image
                    src={`${IMG_HOST}${place.cover.full}?d=${coverHashString}`}
                    alt={place.title || ''}
                    fill={true}
                    priority={true}
                    fetchPriority={'high'}
                    style={{ objectFit: 'cover' }}
                    // The hero spans the content column: full viewport below --width-max (1260px), 1228px above
                    sizes={'(max-width: 1260px) 100vw, 1228px'}
                />
            )}

            <div className={styles.topPanel}>
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
                                                  landingFlags.combinations && mostSpecificAddress
                                                      ? {
                                                            id: mostSpecificAddress.id,
                                                            slug: mostSpecificAddress.slug,
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
            </div>

            <div className={styles.bottomPanel}>
                <div className={styles.text}>
                    <h1>{place?.title}</h1>

                    {(!!placeAddress.length || !!place?.address?.street) && (
                        <div className={styles.address}>
                            {place?.address?.street && <>{`${place.address.street}, `}</>}
                            {[...placeAddress].reverse().map((address, i, all) => (
                                <span key={`address${address.type}`}>
                                    <Link
                                        href={
                                            address.id
                                                ? buildLocationHref(
                                                      { id: address.id, slug: address.slug, type: address.type },
                                                      landingFlags
                                                  )
                                                : '/places'
                                        }
                                        title={`${t('all-geotags-at-address')} ${address.name}`}
                                    >
                                        {address.name}
                                    </Link>
                                    {all.length - 1 !== i && ', '}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* The dots between the facts sit on the list items, outside the links */}
                    <ul className={styles.facts}>
                        <li className={styles.rating}>
                            {isAuthor ? (
                                <span className={styles.fact}>
                                    <Icon name={'StarFilled'} />
                                    {ratingText}
                                </span>
                            ) : (
                                <a
                                    href={`#${RATE_ANCHOR}`}
                                    className={styles.fact}
                                    title={t('rate-this-place', { defaultValue: 'Оценить место' })}
                                    onClick={handleRateClick}
                                >
                                    <Icon name={'StarFilled'} />
                                    {ratingText}
                                </a>
                            )}
                        </li>

                        {place?.category && (
                            <li>
                                <Link
                                    href={buildCategoryHref(place.category, landingFlags)}
                                    className={styles.fact}
                                    title={`${t('all-places-in-category', { defaultValue: 'Все места категории' })} ${getCategoryTitle(t, place.category)}`}
                                >
                                    <Image
                                        src={categoryImage(place.category).src}
                                        alt={''}
                                        width={16}
                                        height={16}
                                    />
                                    {getCategoryTitle(t, place.category)}
                                </Link>
                            </li>
                        )}

                        <li>
                            <span className={styles.fact}>
                                <Icon name={'Eye'} />
                                {t('place-views-count', {
                                    count: place?.views ?? 0,
                                    formatted: formatThousands(place?.views ?? 0),
                                    defaultValue: '{{formatted}} просмотров'
                                })}
                            </span>
                        </li>

                        {!!place?.distance && (
                            <li>
                                <span className={styles.fact}>
                                    <Icon name={'Ruler'} />
                                    {t('distance-from-you', {
                                        distance: formatThousands(place.distance),
                                        defaultValue: '{{distance}} км от вас'
                                    })}
                                </span>
                            </li>
                        )}
                    </ul>
                </div>
            </div>
        </section>
    )
}
