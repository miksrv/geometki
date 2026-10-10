import React, { useEffect, useMemo, useState } from 'react'
import ReactCrop, { Crop } from 'react-image-crop'
import { Button, Dialog } from 'simple-react-ui-kit'

import Image from 'next/image'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel } from '@/api'
import { toggleOverlay } from '@/app/applicationSlice'
import { useAppDispatch } from '@/app/store'
import { resolveImageUrl } from '@/components/shared/photo-lightbox/utils'
import { PLACE_COVER_ASPECT, PLACE_COVER_MIN_HEIGHT, PLACE_COVER_MIN_WIDTH } from '@/config/constants'
import { IMG_HOST } from '@/config/env'

import 'react-image-crop/src/ReactCrop.scss'
import styles from './styles.module.sass'

const SOURCE_NAMES: Record<ApiModel.PhotoExternalSource, string> = {
    pastvu: 'PastVu',
    wikimedia: 'Wikimedia'
}

interface PlaceCoverEditorProps {
    placeId?: string
    open?: boolean
    onClose?: () => void
    onSaveCover?: () => void
}

const PlaceCoverEditor: React.FC<PlaceCoverEditorProps> = ({ placeId, open, onClose, onSaveCover }) => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const { data: photosData, isLoading: photoLoading } = API.usePhotosGetListQuery({ place: placeId })
    // Uploaded photos, and the linked Wikimedia Commons and PastVu ones the server lets a cover be cut from
    // (big enough, a licence that allows changes): the server downloads such a photo only for the cut
    const coverPhotos = useMemo(
        () => photosData?.items?.filter(({ external }) => !external || external.coverAllowed),
        [photosData?.items]
    )

    // A failed save is shown by the API error middleware (app/errorMiddleware.ts), not here
    const [updateCover, { isLoading, isSuccess }] = API.usePlacesPatchCoverMutation()

    const [heightRatio, setHeightRatio] = useState<number>(1)
    const [widthRatio, setWidthRatio] = useState<number>(1)
    const [coverDialogOpen, setCoverDialogOpen] = useState<boolean>(false)
    const [selectedPhotoId, setSelectedPhotoId] = useState<string>('')
    const [imageCropData, setImageCropData] = useState<Crop>()
    // The size of the loaded image: a linked photo is cut from this very file, and a PastVu file is
    // a little taller than its size in the PastVu API (the signature strip)
    const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>()

    const selectedPhoto = useMemo(
        () => coverPhotos?.find(({ id }) => id === selectedPhotoId),
        [selectedPhotoId, coverPhotos]
    )

    const sourceSize = (photo?: ApiModel.Photo) =>
        photo?.external ? naturalSize : photo?.width && photo.height ? photo : undefined

    const disabled = isLoading || !imageCropData?.width || !imageCropData.height

    const handleSelectPhoto = (id: string) => {
        setNaturalSize(undefined)
        setImageCropData(undefined)
        setSelectedPhotoId(id)
    }

    const handleCoverDialogClose = () => {
        dispatch(toggleOverlay(false))
        setCoverDialogOpen(false)
        setSelectedPhotoId('')
        onClose?.()
    }

    const handleSaveCover = async () => {
        const size = sourceSize(selectedPhoto)

        if (!selectedPhoto || !size || disabled) {
            return
        }

        await updateCover({
            ...(selectedPhoto.external ? { externalPhotoId: selectedPhoto.id } : { photoId: selectedPhoto.id }),
            height: Math.round(size.height * ((imageCropData.height || 0) / 100)),
            placeId: placeId!,
            width: Math.round(size.width * ((imageCropData.width || 0) / 100)),
            x: Math.round(size.width * ((imageCropData.x || 0) / 100)),
            y: Math.round(size.height * ((imageCropData.y || 0) / 100))
        })
    }

    const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
        const { width, height, naturalWidth, naturalHeight } = event.currentTarget
        const size = selectedPhoto?.external
            ? { height: naturalHeight, width: naturalWidth }
            : sourceSize(selectedPhoto)

        if (!size?.height || !size.width) {
            return
        }

        setNaturalSize({ height: naturalHeight, width: naturalWidth })

        const ratioW = size.width / width
        const ratioH = size.height / height

        setWidthRatio(ratioW)
        setHeightRatio(ratioH)

        const newHeight = width / PLACE_COVER_ASPECT

        setImageCropData({
            height: (newHeight / height) * 100,
            unit: '%',
            width: 100,
            x: 0,
            y: 0
        })
    }

    useEffect(() => {
        if (open) {
            dispatch(toggleOverlay(true))
            setCoverDialogOpen(true)
        }
    }, [open])

    useEffect(() => {
        if (coverDialogOpen) {
            handleCoverDialogClose()
            onSaveCover?.()
        }
    }, [isSuccess])

    return (
        <Dialog
            contentHeight={'490px'}
            maxWidth={'700px'}
            title={!selectedPhotoId ? t('select-photo') : t('editing')}
            open={coverDialogOpen}
            backLinkCaption={t('back')}
            showBackLink={!!selectedPhotoId}
            onBackClick={() => {
                setSelectedPhotoId('')
            }}
            onCloseDialog={handleCoverDialogClose}
        >
            <>
                {!photoLoading && !coverPhotos?.length && (
                    <div className={styles.noPhotos}>
                        {t('no-photos-here-yet')}
                        <br />
                        {t('first-upload-photos-after-edit-cover')}
                    </div>
                )}
                {!selectedPhotoId ? (
                    <ul className={styles.coverPhotosList}>
                        {coverPhotos?.map((photo) => (
                            <li key={`coverDialog${photo.id}`}>
                                {photo.external ? (
                                    <>
                                        {/* A linked photo stays on its source server, outside the image optimizer */}
                                        {/* eslint-disable-next-line next/no-img-element */}
                                        <img
                                            src={resolveImageUrl(photo.preview)}
                                            alt={''}
                                            width={200}
                                            height={150}
                                            onClick={() => handleSelectPhoto(photo.id)}
                                        />
                                        <span className={styles.source}>{SOURCE_NAMES[photo.external.source]}</span>
                                    </>
                                ) : (
                                    <Image
                                        src={`${IMG_HOST}${photo.preview}`}
                                        alt={''}
                                        width={200}
                                        height={150}
                                        onClick={() => handleSelectPhoto(photo.id)}
                                    />
                                )}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className={styles.innerContainer}>
                        <ReactCrop
                            crop={imageCropData}
                            aspect={PLACE_COVER_ASPECT}
                            minWidth={PLACE_COVER_MIN_WIDTH / widthRatio}
                            minHeight={PLACE_COVER_MIN_HEIGHT / heightRatio}
                            onChange={(c, p) => setImageCropData(p)}
                        >
                            {/* eslint-disable-next-line next/no-img-element */}
                            <img
                                src={resolveImageUrl(selectedPhoto?.full)}
                                onLoad={handleImageLoad}
                                alt={''}
                                style={{
                                    height: '100%',
                                    objectFit: 'cover',
                                    width: '100%'
                                }}
                            />
                        </ReactCrop>
                    </div>
                )}

                {selectedPhoto && (
                    <div className={styles.dialogFooter}>
                        <Button
                            mode={'primary'}
                            label={t('save')}
                            disabled={disabled}
                            onClick={handleSaveCover}
                        />
                    </div>
                )}
            </>
        </Dialog>
    )
}

export { PlaceCoverEditor }
