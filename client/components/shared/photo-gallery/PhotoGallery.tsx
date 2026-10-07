import React, { useEffect, useState } from 'react'
import { Button, cn, Container, ContainerProps, Popout, Spinner } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel } from '@/api'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { ImageUploader } from '@/components/ui'
import { IMG_HOST } from '@/config/env'
import { getErrorMessage } from '@/utils/api'

import styles from './styles.module.sass'

const PhotoLightbox = dynamic(
    () => import('@/components/shared/photo-lightbox/PhotoLightbox').then((m) => ({ default: m.PhotoLightbox })),
    { ssr: false }
)

const ConfirmationDialog = dynamic(() => import('@/components/shared/confirmation-dialog/ConfirmationDialog'), {
    ssr: false
})

const VISIBLE_COUNT = 8

interface PhotoGalleryProps extends ContainerProps {
    photos?: ApiModel.Photo[]
    hideActions?: boolean
    uploadingPhotos?: string[]
    onPhotoDelete?: (photos: ApiModel.Photo[]) => void
    onPhotoUploadClick?: () => void
}

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({
    photos,
    hideActions,
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

    const [localPhotos, setLocalPhotos] = useState<ApiModel.Photo[]>(photos ?? [])
    const [photoLoadingID, setPhotoLoadingID] = useState<string>()
    const [photoDeleteID, setPhotoDeleteID] = useState<string>()
    const [lightboxPhotoIndex, setLightboxPhotoIndex] = useState<number>()

    const [isExpanded, setIsExpanded] = useState<boolean>(false)

    const visiblePhotos = localPhotos.slice(0, VISIBLE_COUNT)
    const hiddenPhotos = localPhotos.slice(VISIBLE_COUNT)

    const isEmptyPhotoList = !localPhotos.length && !uploadingPhotos?.length

    const handleRemoveClick = (photoId: string) => {
        if (isAuth && !deleteLoading && !hideActions) {
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
        if (deleteError || rotateError) {
            void dispatch(
                Notify({
                    id: 'actionPhotoError',
                    title: '',
                    message: getErrorMessage(deleteError) || getErrorMessage(rotateError),
                    type: 'error'
                })
            )
        }
    }, [deleteError, rotateError])

    useEffect(() => {
        const updatedLocalPhotos = localPhotos.filter(({ id }) => id !== deleteData?.id)

        setLocalPhotos(updatedLocalPhotos)
        onPhotoDelete?.(updatedLocalPhotos)
    }, [deleteData])

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
                href={`${IMG_HOST}${photo.full}`}
                title={`${photo.title}. ${t('photo', { defaultValue: 'Фотография' })} ${listIndex + 1}`}
                onClick={(event) => {
                    event.preventDefault()
                    setLightboxPhotoIndex(listIndex)
                }}
            >
                <Image
                    src={`${IMG_HOST}${photo.preview}`}
                    alt={`${photo.title}. ${t('photo', { defaultValue: 'Фотография' })} ${listIndex + 1}`}
                    quality={75}
                    width={206}
                    height={150}
                    sizes={'206px'}
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
                    <Button
                        icon={'Rotate'}
                        mode={'outline'}
                        style={{ width: '100%', justifyContent: 'left' }}
                        label={t('to-turn', { defaultValue: 'Повернуть' })}
                        disabled={!!photoLoadingID}
                        onClick={() => handleRotateClick(photo.id, photo?.placeId === 'temporary')}
                    />
                    <Button
                        icon={'Close'}
                        mode={'outline'}
                        style={{ width: '100%', justifyContent: 'left' }}
                        label={t('delete', { defaultValue: 'Удалить' })}
                        disabled={!!photoLoadingID}
                        onClick={() => handleRemoveClick(photo.id)}
                    />
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
                    <ul className={cn(styles.photoGallery, (!!props?.title || !!props?.action) && styles.marginTop)}>
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
                        <>
                            <div className={cn(styles.collapseWrapper, isExpanded && styles.collapseOpen)}>
                                <div className={styles.collapseInner}>
                                    <ul className={styles.photoGallery}>
                                        {hiddenPhotos.map((photo, index) =>
                                            renderPhotoItem(photo, VISIBLE_COUNT + index)
                                        )}
                                    </ul>
                                </div>
                            </div>

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
                        </>
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
                        const photo = photos?.find(({ id }) => id === photoDeleteID)

                        if (photo) {
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
