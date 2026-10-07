import React, { useEffect, useMemo, useState } from 'react'
import ReactCrop, { Crop } from 'react-image-crop'
import { Button, Dialog } from 'simple-react-ui-kit'

import Image from 'next/image'
import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import { toggleOverlay } from '@/app/applicationSlice'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch } from '@/app/store'
import { PLACE_COVER_ASPECT, PLACE_COVER_MIN_HEIGHT, PLACE_COVER_MIN_WIDTH } from '@/config/constants'
import { IMG_HOST } from '@/config/env'
import { getErrorMessage } from '@/utils/api'

import 'react-image-crop/src/ReactCrop.scss'
import styles from './styles.module.sass'

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

    const [updateCover, { isLoading, isSuccess, isError, error }] = API.usePlacesPatchCoverMutation()

    const [heightRatio, setHeightRatio] = useState<number>(1)
    const [widthRatio, setWidthRatio] = useState<number>(1)
    const [coverDialogOpen, setCoverDialogOpen] = useState<boolean>(false)
    const [selectedPhotoId, setSelectedPhotoId] = useState<string>('')
    const [imageCropData, setImageCropData] = useState<Crop>()

    const selectedPhoto = useMemo(
        () => photosData?.items?.find(({ id }) => id === selectedPhotoId),
        [selectedPhotoId, photosData?.items]
    )

    const disabled = isLoading || !imageCropData?.width || !imageCropData.height

    const handleCoverDialogClose = () => {
        dispatch(toggleOverlay(false))
        setCoverDialogOpen(false)
        setSelectedPhotoId('')
        onClose?.()
    }

    const handleSaveCover = async () => {
        if (!selectedPhoto?.width || !selectedPhoto.height || disabled) {
            return
        }

        await updateCover({
            height: Math.round(selectedPhoto.height * ((imageCropData.height || 0) / 100)),
            photoId: selectedPhotoId!,
            placeId: placeId!,
            width: Math.round(selectedPhoto.width * ((imageCropData.width || 0) / 100)),
            x: Math.round(selectedPhoto.width * ((imageCropData.x || 0) / 100)),
            y: Math.round(selectedPhoto.height * ((imageCropData.y || 0) / 100))
        })
    }

    const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
        const { width, height } = event.currentTarget

        if (!selectedPhoto?.height || !selectedPhoto.width) {
            return
        }

        const ratioW = selectedPhoto.width ? selectedPhoto.width / width : 1
        const ratioH = selectedPhoto.height ? selectedPhoto.height / height : 1

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

    useEffect(() => {
        if (error) {
            void dispatch(
                Notify({
                    id: 'placeCoverEditor',
                    message: getErrorMessage(error),
                    type: 'error'
                })
            )
        }
    }, [isError, error])

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
                {!photoLoading && !photosData?.items?.length && (
                    <div className={styles.noPhotos}>
                        {t('no-photos-here-yet')}
                        <br />
                        {t('first-upload-photos-after-edit-cover')}
                    </div>
                )}
                {!selectedPhotoId ? (
                    <ul className={styles.coverPhotosList}>
                        {photosData?.items?.map((photo) => (
                            <li key={`coverDialog${photo.id}`}>
                                <Image
                                    src={`${IMG_HOST}${photo.preview}`}
                                    alt={''}
                                    width={200}
                                    height={150}
                                    onClick={() => {
                                        setSelectedPhotoId(photo.id)
                                    }}
                                />
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
                                src={`${IMG_HOST}${selectedPhoto?.full}`}
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
