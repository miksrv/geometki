import React, { useEffect, useState } from 'react'
import { Button, cn, Container, ContainerProps, Icon, Popout, Spinner } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel } from '@/api'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { ImageUploader } from '@/components/ui'
import { getErrorMessage } from '@/utils/api'

import { isAbsoluteUrl, resolveImageUrl } from '../photo-lightbox/utils'

import styles from './styles.module.sass'

const PhotoLightbox = dynamic(
    () => import('@/components/shared/photo-lightbox/PhotoLightbox').then((m) => ({ default: m.PhotoLightbox })),
    { ssr: false }
)

const ConfirmationDialog = dynamic(() => import('@/components/shared/confirmation-dialog/ConfirmationDialog'), {
    ssr: false
})

const VISIBLE_COUNT = 8

// A quarter of the content width (--width-max 1260px) on desktop, half the screen on phones
const TILE_SIZES = '(max-width: 768px) 50vw, 320px'

interface PhotoGalleryProps extends ContainerProps {
    photos?: ApiModel.Photo[]
    hideActions?: boolean
    /** Show every photo at once, without the "more photos" button (a page of photos) */
    showAll?: boolean
    uploadingPhotos?: string[]
    onPhotoDelete?: (photos: ApiModel.Photo[]) => void
    onPhotoUploadClick?: () => void
}

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({
    photos,
    hideActions,
    showAll,
    uploadingPhotos,
    onPhotoDelete,
    onPhotoUploadClick,
    ...props
}) => {
    const { t } = useTranslation('components.photo-gallery')
    const dispatch = useAppDispatch()

    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const [deletePhoto, { data: deleteData, isLoading: deleteLoading, error: deleteError }] =
        API.usePhotoDeleteItemMutation()
    const [rotatePhoto, { data: rotateData, isLoading: rotateLoading, error: rotateError }] =
        API.usePhotoRotateItemMutation()
    // Linked Wikimedia Commons and PastVu photos are removed from the place, the images stay in the source
    const [unlinkPhoto, { data: unlinkData, isLoading: unlinkLoading, error: unlinkError }] =
        API.useExternalPhotosDeleteLinkMutation()

    const [localPhotos, setLocalPhotos] = useState<ApiModel.Photo[]>(photos ?? [])
    const [photoLoadingID, setPhotoLoadingID] = useState<string>()
    const [photoDeleteID, setPhotoDeleteID] = useState<string>()
    const [lightboxPhotoIndex, setLightboxPhotoIndex] = useState<number>()

    const [isExpanded, setIsExpanded] = useState<boolean>(false)

    const visibleCount = showAll ? localPhotos.length : VISIBLE_COUNT
    const visiblePhotos = localPhotos.slice(0, visibleCount)
    const hiddenPhotos = localPhotos.slice(visibleCount)

    const isEmptyPhotoList = !localPhotos.length && !uploadingPhotos?.length

    const handleRemoveClick = (photoId: string) => {
        if (isAuth && !deleteLoading && !unlinkLoading && !hideActions) {
            setPhotoLoadingID(photoId)
            setPhotoDeleteID(photoId)
        }
    }

    const handleRotateClick = async (photoId: string, temporary?: boolean) => {
        if (isAuth && !rotateLoading && !hideActions) {
            setPhotoLoadingID(photoId)
            void rotatePhoto({ id: photoId, temporary })
        }
    }

    useEffect(() => {
        const randomString = '?d=' + Math.floor(Date.now() / 1000)

        setLocalPhotos(
            localPhotos.map((photo) => ({
                ...photo,
                full: photo.id === rotateData?.id ? rotateData.full + randomString : photo.full,
                preview: photo.id === rotateData?.id ? rotateData.preview + randomString : photo.preview
            }))
        )

        setPhotoLoadingID(undefined)
    }, [rotateData])

    useEffect(() => {
        if (deleteError || rotateError || unlinkError) {
            void dispatch(
                Notify({
                    id: 'actionPhotoError',
                    title: '',
                    message:
                        getErrorMessage(deleteError) || getErrorMessage(rotateError) || getErrorMessage(unlinkError),
                    type: 'error'
                })
            )
        }
    }, [deleteError, rotateError, unlinkError])

    const removeLocalPhoto = (photoId?: string) => {
        if (!photoId) {
            return
        }

        const updatedLocalPhotos = localPhotos.filter(({ id }) => id !== photoId)

        setLocalPhotos(updatedLocalPhotos)
        onPhotoDelete?.(updatedLocalPhotos)
    }

    // Separate effects: a mutation keeps its last result, so one shared id would repeat
    // the previous deletion instead of the new unlink
    useEffect(() => removeLocalPhoto(deleteData?.id), [deleteData])

    useEffect(() => removeLocalPhoto(unlinkData?.id), [unlinkData])

    useEffect(() => {
        setLocalPhotos(photos ?? [])
    }, [photos])

    const renderPhotoItem = (photo: ApiModel.Photo, listIndex: number) => (
        <li
            key={photo.id}
            className={styles.photoItem}
        >
            {photo.id === photoLoadingID && (
                <div className={styles.loader}>
                    <Spinner />
                </div>
            )}

            <Link
                className={styles.link}
                href={resolveImageUrl(photo.full) ?? ''}
                title={`${photo.title}. ${t('photo', { defaultValue: 'Фотография' })} ${listIndex + 1}`}
                onClick={(event) => {
                    event.preventDefault()
                    setLightboxPhotoIndex(listIndex)
                }}
            >
                <Image
                    src={resolveImageUrl(photo.preview) ?? ''}
                    // External hosts (Wikimedia Commons, PastVu) are not allowed for the image optimizer
                    unoptimized={isAbsoluteUrl(photo.preview)}
                    alt={`${photo.title}. ${t('photo', { defaultValue: 'Фотография' })} ${listIndex + 1}`}
                    quality={75}
                    width={700}
                    height={500}
                    sizes={TILE_SIZES}
                    style={{ width: '100%', height: '100%' }}
                />
            </Link>

            {!hideActions && isAuth && (
                <Popout
                    className={styles.actions}
                    closeOnChildrenClick={true}
                    trigger={
                        <Button
                            className={styles.actionButton}
                            mode={'secondary'}
                            size={'small'}
                            icon={'VerticalDots'}
                            tooltip={t('photo-actions', { defaultValue: 'Действия с фотографией' })}
                        />
                    }
                >
                    <ul className={'contextListMenu'}>
                        {!photo.external && (
                            <li>
                                <button
                                    type={'button'}
                                    disabled={!!photoLoadingID}
                                    onClick={() => handleRotateClick(photo.id, photo?.placeId === 'temporary')}
                                >
                                    <Icon name={'Rotate'} />
                                    {t('to-turn', { defaultValue: 'Повернуть' })}
                                </button>
                            </li>
                        )}
                        <li>
                            <button
                                type={'button'}
                                disabled={!!photoLoadingID}
                                onClick={() => handleRemoveClick(photo.id)}
                            >
                                <Icon name={'Close'} />
                                {t('delete', { defaultValue: 'Удалить' })}
                            </button>
                        </li>
                    </ul>
                </Popout>
            )}
        </li>
    )

    return (
        <Container
            {...props}
            className={cn(styles.galleryContainer, props.className)}
        >
            {isEmptyPhotoList && (
                <div className={'emptyList'}>
                    {t('no-photos-here-yet', { defaultValue: 'Тут пока нет фотографий' })}
                </div>
            )}

            {!isEmptyPhotoList && (
                <>
                    <div
                        className={cn(
                            styles.photoGrid,
                            isExpanded && styles.expanded,
                            (!!props?.title || !!props?.action) && styles.marginTop
                        )}
                    >
                        <ul className={styles.photoGallery}>
                            {onPhotoUploadClick && (
                                <li className={cn(styles.photoItem, styles.photoUpload)}>
                                    <ImageUploader onClick={onPhotoUploadClick} />
                                </li>
                            )}

                            {uploadingPhotos?.map((photo) => (
                                <li
                                    key={photo}
                                    className={styles.photoItem}
                                >
                                    <div className={styles.loader}>
                                        <Spinner />
                                    </div>
                                    <Image
                                        src={photo}
                                        alt={''}
                                        width={206}
                                        height={150}
                                    />
                                </li>
                            ))}

                            {visiblePhotos.map((photo, index) => renderPhotoItem(photo, index))}
                        </ul>

                        {!!hiddenPhotos.length && (
                            <div className={cn(styles.collapseWrapper, isExpanded && styles.collapseOpen)}>
                                <div className={styles.collapseInner}>
                                    <ul className={styles.photoGallery}>
                                        {hiddenPhotos.map((photo, index) =>
                                            renderPhotoItem(photo, visibleCount + index)
                                        )}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>

                    {!!hiddenPhotos.length && (
                        <Button
                            mode={'secondary'}
                            stretched={true}
                            className={styles.expandButton}
                            onClick={() => setIsExpanded((prev) => !prev)}
                        >
                            {isExpanded
                                ? t('collapse-photos', { defaultValue: 'Скрыть' })
                                : t('expand-photos', {
                                      count: hiddenPhotos.length,
                                      defaultValue: `Ещё фотографии (${hiddenPhotos.length})`
                                  })}
                        </Button>
                    )}
                </>
            )}

            {typeof lightboxPhotoIndex === 'number' && (
                <PhotoLightbox
                    photos={localPhotos}
                    photoIndex={lightboxPhotoIndex}
                    showLightbox={true}
                    onCloseLightBox={() => setLightboxPhotoIndex(undefined)}
                />
            )}

            {!!photoDeleteID && (
                <ConfirmationDialog
                    open={!!photoDeleteID}
                    message={t('delete-photo', { defaultValue: 'Удалить фотографию?' })}
                    onCancel={() => {
                        setPhotoDeleteID(undefined)
                        setPhotoLoadingID(undefined)
                    }}
                    onConfirm={async () => {
                        const photo = localPhotos.find(({ id }) => id === photoDeleteID)

                        if (photo?.external) {
                            await unlinkPhoto({ id: photo.id, placeId: photo.placeId })
                            setPhotoDeleteID(undefined)
                            setPhotoLoadingID(undefined)
                        } else if (photo) {
                            await deletePhoto({ id: photo?.id, temporary: photo?.placeId === 'temporary' })
                            setPhotoDeleteID(undefined)
                            setPhotoLoadingID(undefined)
                        }
                    }}
                />
            )}
        </Container>
    )
}
