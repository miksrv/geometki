import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import ReactCrop, { Crop } from 'react-image-crop'
import { Button } from 'simple-react-ui-kit'

import Image from 'next/image'
import { useTranslation } from 'next-i18next'

import { API, useAppDispatch, useAppSelector } from '@/api'
import { IMG_HOST } from '@/config/env'
import { openAuthDialog, toggleOverlay } from '@/app/applicationSlice'
import { Notify } from '@/app/notificationSlice'
import { Dialog } from '@/components/ui'

import 'react-image-crop/src/ReactCrop.scss'
import styles from './styles.module.sass'

interface PlaceCoverEditorProps {
    placeId?: string
    onSaveCover?: () => void
}

export interface PlaceCoverEditorRefProps {
    handleChangeCoverClick: (event: React.MouseEvent) => void
}

const PlaceCoverEditor: React.ForwardRefRenderFunction<PlaceCoverEditorRefProps, PlaceCoverEditorProps> = (
    { placeId, onSaveCover },
    ref
) => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const authSlice = useAppSelector((state) => state.auth)

    const { data: photosData, isLoading: photoLoading } = API.usePhotosGetListQuery({ place: placeId })

    const [updateCover, { isLoading, isSuccess, isError, error }] = API.usePlacesPatchCoverMutation()

    const [heightRatio, setHeightRatio] = useState<number>(1)
    const [widthRatio, setWidthRatio] = useState<number>(1)
    const [coverDialogOpen, setCoverDialogOpen] = useState<boolean>(false)
    const [selectedPhotoId, setSelectedPhotoId] = useState<string>('')
    const [imageCropData, setImageCropData] = useState<Crop>()

    const selectedPhoto = useMemo(() => photosData?.items?.find(({ id }) => id === selectedPhotoId), [selectedPhotoId])

    const disabled = isLoading || !imageCropData?.width || !imageCropData.height

    const handleChangeCoverClick = (event: React.MouseEvent) => {
        if (!authSlice.isAuth) {
            event.stopPropagation()
            dispatch(openAuthDialog())
        } else {
            dispatch(toggleOverlay(true))
            setCoverDialogOpen(true)
        }
    }

    const handleCoverDialogClose = () => {
        dispatch(toggleOverlay(false))
        setCoverDialogOpen(false)
        setSelectedPhotoId('')
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

        const newHeight = (width / 870) * 300

        setImageCropData({
            height: (newHeight / height) * 100,
            unit: '%',
            width: 100,
            x: 0,
            y: 0
        })
    }

    useImperativeHandle(ref, () => ({
        handleChangeCoverClick
    }))

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
                    message: error as string,
                    type: 'error'
                })
            )
        }
    }, [isError, error])

    return (
        <Dialog
            contentHeight={'490px'}
            maxWidth={'700px'}
            header={!selectedPhotoId ? t('select-photo') : t('editing')}
            open={coverDialogOpen}
            backLinkCaption={t('back')}
            showBackLink={!!selectedPhotoId}
            actions={
                selectedPhoto && (
                    <Button
                        size={'small'}
                        mode={'primary'}
                        label={t('save')}
                        disabled={disabled}
                        onClick={handleSaveCover}
                    />
                )
            }
            onBackClick={() => {
                setSelectedPhotoId('')
            }}
            onCloseDialog={handleCoverDialogClose}
        >
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
                        aspect={870 / 300}
                        minWidth={870 / widthRatio}
                        minHeight={300 / heightRatio}
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
        </Dialog>
    )
}

export const ForwardedPlaceCoverEditor = forwardRef(PlaceCoverEditor)
