import React, { useState } from 'react'
import { cn } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { isAbsoluteUrl, resolveImageUrl } from '@/components/shared/photo-lightbox/utils'

import type { FeedDensity } from './FeedStory'

import styles from './styles.module.sass'

const PhotoLightbox = dynamic(
    () => import('@/components/shared/photo-lightbox/PhotoLightbox').then((m) => ({ default: m.PhotoLightbox })),
    { ssr: false }
)

export interface FeedPhotoMosaicProps {
    photos: ApiModel.Photo[]
    /** All photos of the story; more than shown puts "+N" on the last tile */
    total?: number
    density?: FeedDensity
    /** The place the photos are of: their alt text and button names */
    placeTitle?: string
}

/** Tiles of the mosaic; more photos put "+N" on the last one */
const SHOWN = 4

/**
 * The photos of a feed story, the same in every story (new photos, linked photos, a new
 * place): 1 — wide, 2 — two columns, 3 — a tall one and two, 4+ — 2×2. Any tile opens
 * the lightbox with all the story's photos.
 */
export const FeedPhotoMosaic: React.FC<FeedPhotoMosaicProps> = ({ photos, total, density = 'full', placeTitle }) => {
    const { t } = useTranslation()

    const [photoIndex, setPhotoIndex] = useState<number>()
    const [showLightbox, setShowLightbox] = useState(false)

    const shown = photos.slice(0, SHOWN)
    const more = Math.max(0, (total ?? photos.length) - shown.length)

    return (
        <>
            <div
                className={cn(styles.mosaic, density === 'compact' && styles.mosaicCompact)}
                data-count={shown.length}
            >
                {shown.map((photo, index) => {
                    const name = placeTitle
                        ? t('feed-photo-alt', { number: index + 1, title: placeTitle })
                        : `${t('photo', { defaultValue: 'Фото' })} ${index + 1}`
                    const hasMore = more > 0 && index === shown.length - 1

                    return (
                        <button
                            key={photo.id ?? photo.preview}
                            type={'button'}
                            className={styles.mosaicCell}
                            onClick={() => {
                                setPhotoIndex(index)
                                setShowLightbox(true)
                            }}
                            aria-label={hasMore ? `${name}, ${t('feed-photo-more', { count: more })}` : name}
                        >
                            <Image
                                src={resolveImageUrl(photo.preview) ?? ''}
                                // Linked PastVu / Commons photos: their hosts are not allowed in the optimizer
                                unoptimized={isAbsoluteUrl(photo.preview)}
                                alt={name}
                                fill
                                sizes={'(max-width: 1024px) 100vw, 920px'}
                                className={styles.mosaicImage}
                            />
                            {hasMore && (
                                <span
                                    className={styles.mosaicMore}
                                    aria-hidden={true}
                                >{`+${more}`}</span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Loaded on the first tap: the lightbox is not part of the feed's first load */}
            {showLightbox && (
                <PhotoLightbox
                    photos={photos}
                    photoIndex={photoIndex}
                    showLightbox={true}
                    onCloseLightBox={() => setShowLightbox(false)}
                />
            )}
        </>
    )
}
