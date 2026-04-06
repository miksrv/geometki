import React from 'react'
import Lightbox, { RenderFunction, RenderSlideProps, Slide } from 'yet-another-react-lightbox'
import Captions from 'yet-another-react-lightbox/plugins/captions'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'

import Link from 'next/link'
import { useTranslation } from 'next-i18next'

import { ApiModel } from '@/api'
import { IMG_HOST } from '@/config/env'
import { formatDate } from '@/utils/helpers'

import { UserAvatar } from '../user-avatar'

import { ImageSlide } from './ImageSlide'

import 'yet-another-react-lightbox/plugins/captions.css'
import 'yet-another-react-lightbox/styles.css'
import styles from './styles.module.sass'

interface PhotoLightboxProps {
    photos?: ApiModel.Photo[] | ApiModel.PhotoMark[]
    photoIndex?: number
    showLightbox?: boolean
    onCloseLightBox?: () => void
    onChangeIndex?: (index: number) => void
}

export const PhotoLightbox: React.FC<PhotoLightboxProps> = ({
    photos,
    photoIndex = 0,
    showLightbox,
    onCloseLightBox
}) => {
    const { t } = useTranslation('components.photo-lightbox')

    const imageHost = (link?: string) =>
        link?.includes('http://') || link?.includes('https://') ? link : `${IMG_HOST}${link}`

    return (
        <Lightbox
            open={!!showLightbox}
            index={photoIndex}
            plugins={[Captions, Zoom]}
            close={onCloseLightBox}
            render={{ slide: ImageSlide as RenderFunction<RenderSlideProps> }}
            slides={photos?.map(
                (photo) =>
                    ({
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
                        height: (photo as ApiModel.Photo).height,
                        src: imageHost(photo.full),
                        // srcSet: [{ src: imageHost(photo.preview), width: 300, height: 200 }],
                        title: photo.placeId ? (
                            <Link
                                href={`/places/${photo.placeId}`}
                                title={photo.title}
                                className={styles.title}
                            >
                                {photo.title}
                            </Link>
                        ) : (
                            photo.title
                        ),
                        width: (photo as ApiModel.Photo).width
                    }) as Slide
            )}
        />
    )
}
