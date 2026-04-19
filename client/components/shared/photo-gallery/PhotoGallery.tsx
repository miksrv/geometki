import React, { useEffect, useMemo, useState } from 'react'
import { Button, cn, Container, ContainerProps, Popout, Spinner } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next'

import { API, ApiModel } from '@/api'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { PhotoLightbox } from '@/components/shared'
import { ImageUploader } from '@/components/ui'
import { IMG_HOST } from '@/config/env'
import { getErrorMessage } from '@/utils/api'

import styles from './styles.module.sass'

const ConfirmationDialog = dynamic(() => import('@/components/shared/confirmation-dialog/ConfirmationDialog'), {
    ssr: false
})

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

    const isEmptyPhotoList = useMemo(
        () => !localPhotos.length && !uploadingPhotos?.length,
        [localPhotos.length, uploadingPhotos?.length]
    )

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

    /**
     * After rotate photo - add time hash for rotated photo
     */
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

    /**
     * Show errors as notify
     */
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

    /**
     *  After deleting a photo, remove it from the local photo list
     */
    useEffect(() => {
        const updatedLocalPhotos = localPhotos.filter(({ id }) => id !== deleteData?.id)

        setLocalPhotos(updatedLocalPhotos)
        onPhotoDelete?.(updatedLocalPhotos)
    }, [deleteData])

    useEffect(() => {
        setLocalPhotos(photos ?? [])
    }, [photos])

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

                    {localPhotos.map((photo, index) => (
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
                                title={`${photo.title}. ${t('photo', { defaultValue: 'Фотография' })} ${index + 1}`}
                                onClick={(event) => {
                                    event.preventDefault()
                                    setLightboxPhotoIndex(index)
                                }}
                            >
                                <Image
                                    src={`${IMG_HOST}${photo.preview}`}
                                    alt={`${photo.title}. ${t('photo', { defaultValue: 'Фотография' })} ${index + 1}`}
                                    quality={50}
                                    width={206}
                                    height={150}
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
                    ))}
                </ul>
            )}

            <PhotoLightbox
                photos={localPhotos}
                photoIndex={lightboxPhotoIndex}
                showLightbox={typeof lightboxPhotoIndex === 'number'}
                onCloseLightBox={() => setLightboxPhotoIndex(undefined)}
            />

            <ConfirmationDialog
                open={!!photoDeleteID}
                message={t('delete-photo', { defaultValue: 'Удалить фотографию?' })}
                acceptText={t('delete', { defaultValue: 'Удалить' })}
                onReject={() => {
                    setPhotoDeleteID(undefined)
                    setPhotoLoadingID(undefined)
                }}
                onAccept={async () => {
                    const photo = photos?.find(({ id }) => id === photoDeleteID)

                    if (photo) {
                        await deletePhoto({ id: photo?.id, temporary: photo?.placeId === 'temporary' })
                        setPhotoDeleteID(undefined)
                        setPhotoLoadingID(undefined)
                    }
                }}
            />
        </Container>
    )
}
