import React, { useEffect, useMemo, useState } from 'react'
import ReactCrop, { PercentCrop } from 'react-image-crop'
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

// The tallest the photo is shown in the dialog, px
const CROP_AREA_HEIGHT = 420

/** A photo a cover can be cut from: big enough for the smallest crop the API accepts (when its size is known) */
const fitsCover = ({ width, height }: ApiModel.Photo) =>
    !width || !height || (width >= PLACE_COVER_MIN_WIDTH && height >= PLACE_COVER_MIN_HEIGHT)

/**
 * The biggest 3:1 box in the middle of an image, in percent of it: the same cut the API makes
 * from a photo without a crop. A panorama wider than 3:1 gets its full height.
 */
const initialCrop = (width: number, height: number): PercentCrop => {
    const cropWidth = width / height > PLACE_COVER_ASPECT ? ((height * PLACE_COVER_ASPECT) / width) * 100 : 100
    const cropHeight = width / height > PLACE_COVER_ASPECT ? 100 : (width / PLACE_COVER_ASPECT / height) * 100

    return { height: cropHeight, unit: '%', width: cropWidth, x: (100 - cropWidth) / 2, y: (100 - cropHeight) / 2 }
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
        () =>
            photosData?.items?.filter((photo) => (!photo.external || photo.external.coverAllowed) && fitsCover(photo)),
        [photosData?.items]
    )

    // A failed save is shown by the API error middleware (app/errorMiddleware.ts), not here
    const [updateCover, { isLoading, isSuccess }] = API.usePlacesPatchCoverMutation()

    const [coverDialogOpen, setCoverDialogOpen] = useState<boolean>(false)
    const [selectedPhotoId, setSelectedPhotoId] = useState<string>('')
    const [imageCropData, setImageCropData] = useState<PercentCrop>()
    // The size of the loaded file: the API cuts this very file (a PastVu file is a little taller
    // than its size in the PastVu API: the signature strip). `scale` — file pixels per screen pixel
    const [naturalSize, setNaturalSize] = useState<{ width: number; height: number; scale: number }>()

    const selectedPhoto = useMemo(
        () => coverPhotos?.find(({ id }) => id === selectedPhotoId),
        [selectedPhotoId, coverPhotos]
    )

    // The crop box in the pixels of the file, as the API takes it
    const cropBox =
        naturalSize && imageCropData?.width && imageCropData.height
            ? {
                  height: Math.round(naturalSize.height * (imageCropData.height / 100)),
                  width: Math.round(naturalSize.width * (imageCropData.width / 100)),
                  x: Math.round(naturalSize.width * (imageCropData.x / 100)),
                  y: Math.round(naturalSize.height * (imageCropData.y / 100))
              }
            : undefined

    const disabled =
        isLoading || !cropBox || cropBox.width < PLACE_COVER_MIN_WIDTH || cropBox.height < PLACE_COVER_MIN_HEIGHT

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
        if (!selectedPhoto || !cropBox || disabled) {
            return
        }

        await updateCover({
            ...(selectedPhoto.external ? { externalPhotoId: selectedPhoto.id } : { photoId: selectedPhoto.id }),
            ...cropBox,
            placeId: placeId!
        })
    }

    const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
        const { width, naturalWidth, naturalHeight } = event.currentTarget

        if (!width || !naturalWidth || !naturalHeight) {
            return
        }

        setNaturalSize({ height: naturalHeight, scale: naturalWidth / width, width: naturalWidth })
        setImageCropData(initialCrop(naturalWidth, naturalHeight))
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
            onBackClick={() => handleSelectPhoto('')}
            onCloseDialog={handleCoverDialogClose}
        >
            <>
                {!photoLoading && !coverPhotos?.length && (
                    <div className={styles.noPhotos}>
                        {/* Photos there are, but none big enough or with a licence that allows a cover */}
                        {photosData?.items?.length ? t('no-cover-photos-here') : t('no-photos-here-yet')}
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
                        {/* The photo keeps its proportions: the box in percent of it is the box in the file */}
                        <ReactCrop
                            crop={imageCropData}
                            aspect={PLACE_COVER_ASPECT}
                            keepSelection={true}
                            minWidth={naturalSize ? PLACE_COVER_MIN_WIDTH / naturalSize.scale : undefined}
                            minHeight={naturalSize ? PLACE_COVER_MIN_HEIGHT / naturalSize.scale : undefined}
                            style={{ maxHeight: CROP_AREA_HEIGHT }}
                            onChange={(_, percentCrop) => setImageCropData(percentCrop)}
                        >
                            {/* eslint-disable-next-line next/no-img-element */}
                            <img
                                src={resolveImageUrl(selectedPhoto?.full)}
                                onLoad={handleImageLoad}
                                alt={''}
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
