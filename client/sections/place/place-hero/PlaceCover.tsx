import React, { useEffect, useRef, useState } from 'react'
import { Button, cn, Icon, Skeleton } from 'simple-react-ui-kit'

import Image, { ImageProps } from 'next/image'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { isAbsoluteUrl, resolveImageUrl } from '@/components/shared/photo-lightbox/utils'
import { IMG_HOST } from '@/config/env'

import styles from './styles.module.sass'

// A phone carousel carries the cover and this many photos; the "1 / N" counter leads to all of them
const MAX_CAROUSEL_PHOTOS = 8

const SOURCE_NAMES: Record<ApiModel.PhotoExternalSource, string> = {
    pastvu: 'PastVu',
    wikimedia: 'Wikimedia Commons'
}

/** The caption of a cover cut from a linked photo: the author, the licence and the source page */
const CoverCredit: React.FC<{ credit: ApiModel.PlaceCoverCredit }> = ({ credit }) => {
    const { t } = useTranslation()

    const parts: React.ReactNode[] = [
        credit.author ? `© ${credit.author}` : null,
        credit.license && credit.licenseUrl ? (
            <a
                href={credit.licenseUrl}
                target={'_blank'}
                rel={'noopener noreferrer'}
            >
                {credit.license}
            </a>
        ) : (
            credit.license
        ),
        <a
            key={'source'}
            href={credit.url}
            target={'_blank'}
            rel={'noopener noreferrer'}
        >
            {SOURCE_NAMES[credit.source]}
        </a>
    ].filter(Boolean)

    return (
        <div className={styles.coverCredit}>
            {t('cover-credit_photo', { defaultValue: 'Фото' })}:{' '}
            {parts.map((part, index) => (
                <React.Fragment key={index}>
                    {index > 0 && ' · '}
                    {part}
                </React.Fragment>
            ))}
        </div>
    )
}

/**
 * A picture of the carousel over a skeleton: the shimmer fills the slide until the image has
 * loaded (or failed), then goes away. It lies under the image, so without JavaScript the image
 * still shows over it. Keyed by `src` where used: a replaced cover starts over.
 */
const SlideImage: React.FC<ImageProps> = (props) => {
    const [loaded, setLoaded] = useState<boolean>(false)
    const imageRef = useRef<HTMLImageElement>(null)

    // A server-rendered image can finish loading before hydration: `onLoad` never fires then
    useEffect(() => {
        if (imageRef.current?.complete) {
            setLoaded(true)
        }
    }, [])

    return (
        <>
            {!loaded && (
                <Skeleton
                    className={styles.skeleton}
                    aria-hidden={true}
                />
            )}
            <Image
                {...props}
                ref={imageRef}
                alt={props.alt}
                onLoad={() => setLoaded(true)}
                onError={() => setLoaded(true)}
            />
        </>
    )
}

interface PlaceCoverProps {
    place?: ApiModel.Place
    photos?: ApiModel.Photo[]
    coverHash?: number | string
    /** The last slide on phones invites to add photos */
    onPhotoUploadClick?: (event?: React.MouseEvent) => void
    /** The "1 / N" counter on phones: all the photos as the grid of the viewer */
    onAllPhotosClick?: () => void
    /** A tap on a picture: that photo in the viewer (the cover is a crop of a photo: the first one) */
    onPhotoClick?: (index: number) => void
}

/**
 * The picture of the place. Desktop: the clean cover, 3:1 like the file, nothing over it but
 * a small credit. Phones: a swipeable carousel of the cover and every photo (4:3, edge to edge)
 * with a "1 / N" counter, ending with an invitation to add photos — the photos section is not
 * shown there. A tap opens the photo viewer of the page. Without a cover desktop shows nothing; phones still
 * get the photos.
 */
export const PlaceCover: React.FC<PlaceCoverProps> = ({
    place,
    photos,
    coverHash,
    onPhotoUploadClick,
    onAllPhotosClick,
    onPhotoClick
}) => {
    const { t } = useTranslation()

    const trackRef = useRef<HTMLDivElement>(null)
    const [current, setCurrent] = useState<number>(0)

    const cover = place?.cover
    const photoList = photos ?? []
    // The cover counts as the first picture: "1 / 6" for a cover and five photos
    const mediaCount = (cover ? 1 : 0) + photoList.length
    // Only the first photos get a slide: a place with hundreds would bloat the HTML and the hydration
    const slidePhotos = photoList.slice(0, MAX_CAROUSEL_PHOTOS)
    const slideCount = (cover ? 1 : 0) + slidePhotos.length

    useEffect(() => {
        const track = trackRef.current

        if (!track) {
            return
        }

        let frame = 0

        const handleScroll = () => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(() => {
                setCurrent(Math.round(track.scrollLeft / Math.max(track.clientWidth, 1)))
            })
        }

        track.addEventListener('scroll', handleScroll, { passive: true })

        return () => {
            cancelAnimationFrame(frame)
            track.removeEventListener('scroll', handleScroll)
        }
    }, [])

    if (!mediaCount && !onPhotoUploadClick) {
        return null
    }

    // The cover is a crop of a photo, it opens the viewer at the first one
    const openPhoto = (index: number) => {
        if (photoList.length) {
            onPhotoClick?.(index)
        }
    }

    const photoAlt = (index: number) =>
        `${place?.title ?? ''} — ${t('photo', { defaultValue: 'Фотография' }).toLowerCase()} ${index + 1}`

    return (
        <div className={cn(styles.cover, !cover && styles.noCover, !mediaCount && styles.onlyInvite)}>
            <div
                ref={trackRef}
                className={styles.track}
            >
                {cover && (
                    <button
                        type={'button'}
                        className={styles.slide}
                        aria-label={place?.title}
                        onClick={() => openPhoto(0)}
                    >
                        <SlideImage
                            key={`${cover.full}?d=${coverHash}`}
                            src={`${IMG_HOST}${cover.full}?d=${coverHash}`}
                            alt={place?.title || ''}
                            fill={true}
                            priority={true}
                            fetchPriority={'high'}
                            style={{ objectFit: 'cover' }}
                            // The full content width on desktop (1228px above --width-max), the screen on phones
                            sizes={'(max-width: 1260px) 100vw, 1228px'}
                        />
                    </button>
                )}

                {slidePhotos.map((photo, index) => (
                    <button
                        key={photo.id}
                        type={'button'}
                        className={cn(styles.slide, styles.photoSlide)}
                        aria-label={photoAlt(index)}
                        onClick={() => openPhoto(index)}
                    >
                        <SlideImage
                            src={resolveImageUrl(photo.full) ?? ''}
                            unoptimized={isAbsoluteUrl(photo.full)}
                            alt={photoAlt(index)}
                            fill={true}
                            // The first picture of a cover-less place is the visible one on phones
                            priority={!cover && index === 0}
                            style={{ objectFit: 'cover' }}
                            sizes={'100vw'}
                        />
                    </button>
                ))}

                {onPhotoUploadClick && (
                    <div className={cn(styles.slide, styles.inviteSlide)}>
                        <Icon name={'Camera'} />
                        <strong>{t('photos-invite-title', { defaultValue: 'Были здесь?' })}</strong>
                        <span>
                            {t('photos-invite-text', {
                                defaultValue: 'Добавьте свои фото — они помогут увидеть место в другое время года'
                            })}
                        </span>
                        <Button
                            mode={'primary'}
                            size={'medium'}
                            icon={'Camera'}
                            label={t('add-photo', { defaultValue: 'Добавить фото' })}
                            onClick={onPhotoUploadClick}
                        />
                    </div>
                )}
            </div>

            {cover?.credit && <CoverCredit credit={cover.credit} />}

            {mediaCount > 1 && current < slideCount && (
                <button
                    type={'button'}
                    className={styles.counter}
                    aria-label={t('all-photos-count', {
                        count: photoList.length,
                        defaultValue: 'Все фото ({{count}})'
                    })}
                    onClick={onAllPhotosClick}
                >
                    <Icon name={'Photo'} />
                    {`${current + 1} / ${mediaCount}`}
                </button>
            )}
        </div>
    )
}
