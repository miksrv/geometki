import React, { useMemo } from 'react'
import Lightbox, { isImageSlide, Slide } from 'yet-another-react-lightbox'
import Captions from 'yet-another-react-lightbox/plugins/captions'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'

import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { buildPlaceUrl, formatDate } from '@/utils/helpers'

import { UserAvatar } from '../user-avatar'

import { SlidePreview } from './SlidePreview'
import { buildSrcSet, isAbsoluteUrl, resolveImageUrl } from './utils'

import 'yet-another-react-lightbox/plugins/captions.css'
import 'yet-another-react-lightbox/styles.css'
import styles from './styles.module.sass'

declare module 'yet-another-react-lightbox' {
    interface SlideImage {
        /** Shown while the full photo loads */
        preview?: string
    }
}

interface PhotoLightboxProps {
    photos?: ApiModel.Photo[] | ApiModel.PhotoMark[]
    photoIndex?: number
    showLightbox?: boolean
    onCloseLightBox?: () => void
}

export const PhotoLightbox: React.FC<PhotoLightboxProps> = ({
    photos,
    photoIndex = 0,
    showLightbox,
    onCloseLightBox
}) => {
    const { t } = useTranslation('components.photo-lightbox')

    const slides = useMemo(
        () =>
            (photos ?? []).map((photo): Slide => {
                const src = resolveImageUrl(photo.full) ?? ''
                const { width, height } = photo
                // Only our own photos go through the image optimizer, external hosts are not allowed there
                const srcSet =
                    width && height && !isAbsoluteUrl(photo.full) ? buildSrcSet(src, width, height) : undefined

                return {
                    alt: photo.title,
                    description: photo.author && (
                        <UserAvatar
                            size={'medium'}
                            showName={true}
                            user={photo.author}
                            className={styles.caption}
                            caption={formatDate(
                                photo.created?.date,
                                t('date_time_format', { defaultValue: 'D MMMM YYYY, HH:mm' })
                            )}
                        />
                    ),
                    height,
                    preview: resolveImageUrl(photo.preview),
                    src,
                    srcSet: srcSet?.length ? srcSet : undefined,
                    title: photo.placeId ? (
                        <Link
                            href={buildPlaceUrl(photo.placeId)}
                            title={photo.title}
                            className={styles.title}
                        >
                            {photo.title}
                        </Link>
                    ) : (
                        photo.title
                    ),
                    width
                }
            }),
        [photos, t]
    )

    const single = slides.length <= 1

    return (
        <Lightbox
            open={!!showLightbox}
            index={Math.min(Math.max(photoIndex, 0), Math.max(slides.length - 1, 0))}
            plugins={[Captions, Zoom]}
            close={onCloseLightBox}
            slides={slides}
            // A single photo has nothing to scroll to: no looping and no arrows
            carousel={{ finite: single }}
            render={{
                buttonNext: single ? () => null : undefined,
                buttonPrev: single ? () => null : undefined,
                slideContainer: ({ slide, children }) =>
                    isImageSlide(slide) ? (
                        <SlidePreview
                            preview={slide.preview}
                            width={slide.width}
                            height={slide.height}
                        >
                            {children}
                        </SlidePreview>
                    ) : (
                        children
                    )
            }}
        />
    )
}
