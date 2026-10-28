import React, { useState } from 'react'
import { Button } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { formatPlainDate } from '@/utils/date'
import { buildPlaceUrl } from '@/utils/place'
import { answerTexts } from '@/utils/visitQuestions'

import { isAbsoluteUrl, resolveImageUrl } from '../photo-lightbox/utils'

import styles from './styles.module.sass'

const PhotoLightbox = dynamic(
    () => import('@/components/shared/photo-lightbox/PhotoLightbox').then((m) => ({ default: m.PhotoLightbox })),
    { ssr: false }
)

interface VisitRowProps {
    visit: ApiModel.Visit
    /** The visit is the visitor's own: the delete action */
    onDelete?: (visit: ApiModel.Visit) => void
}

/**
 * One visit in the profile timeline: the place (cover and title), the day and the photos of the
 * day, which open in the lightbox; the owner of the profile can delete it.
 */
export const VisitRow: React.FC<VisitRowProps> = ({ visit, onDelete }) => {
    const { t } = useTranslation()

    const [photoIndex, setPhotoIndex] = useState<number>()

    const { place, photos } = visit
    const answers = answerTexts(visit.answers, t)
    const placeHref = place ? buildPlaceUrl(place.id, place.slug) : undefined

    return (
        <li className={styles.row}>
            {place?.cover?.preview && (
                <Link
                    href={placeHref ?? '#'}
                    className={styles.cover}
                    tabIndex={-1}
                    aria-hidden={true}
                >
                    <Image
                        src={resolveImageUrl(place.cover.preview) ?? ''}
                        unoptimized={isAbsoluteUrl(place.cover.preview)}
                        alt={''}
                        width={96}
                        height={64}
                        style={{ objectFit: 'cover' }}
                    />
                </Link>
            )}

            <div className={styles.body}>
                <div className={styles.head}>
                    {placeHref && (
                        <Link
                            href={placeHref}
                            className={styles.name}
                        >
                            {place?.title}
                        </Link>
                    )}

                    <time
                        className={styles.date}
                        dateTime={visit.visitedAt}
                    >
                        {formatPlainDate(visit.visitedAt)}
                    </time>

                    {onDelete && (
                        <Button
                            mode={'link'}
                            size={'small'}
                            icon={'Close'}
                            className={styles.delete}
                            tooltip={t('visit-delete')}
                            aria-label={t('visit-delete')}
                            onClick={() => onDelete(visit)}
                        />
                    )}
                </div>

                {!!answers.length && <p className={styles.answers}>{answers.join(' · ')}</p>}

                {!!photos?.length && (
                    <ul className={styles.photos}>
                        {photos.map((photo, index) => (
                            <li key={photo.id}>
                                <button
                                    type={'button'}
                                    aria-label={photo.title ?? t('photo', { defaultValue: 'Фотография' })}
                                    onClick={() => setPhotoIndex(index)}
                                >
                                    <Image
                                        src={resolveImageUrl(photo.preview) ?? ''}
                                        unoptimized={isAbsoluteUrl(photo.preview)}
                                        alt={photo.title ?? ''}
                                        width={160}
                                        height={120}
                                    />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {typeof photoIndex === 'number' && photos && (
                <PhotoLightbox
                    photos={photos}
                    photoIndex={photoIndex}
                    showLightbox={true}
                    onCloseLightBox={() => setPhotoIndex(undefined)}
                />
            )}
        </li>
    )
}
