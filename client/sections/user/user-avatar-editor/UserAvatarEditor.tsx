import React, { useEffect, useRef, useState } from 'react'
import ReactCrop, { Crop } from 'react-image-crop'
import { Button, Dialog, Spinner } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiType } from '@/api'
import { toggleOverlay } from '@/app/applicationSlice'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch } from '@/app/store'
import { UploadZone } from '@/components/ui'
import { IMG_HOST } from '@/config/env'

import 'react-image-crop/src/ReactCrop.scss'
import styles from './styles.module.sass'

/** Image types the API takes for an avatar (`mime_in` of `POST /users/avatar`) */
export const AVATAR_ACCEPT_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** The API's size limit of an avatar (`max_size`, 5120 KB) */
export const AVATAR_MAX_SIZE = 5 * 1024 * 1024

type ImageSizesType = {
    ratioWidth: number
    ratioHeight: number
    realWidth: number
    realHeight: number
    height: number
    width: number
    halfSize: number
    halfRealSize: number
}

interface UserAvatarProps {
    /** The button's label, "Аватар" by default */
    label?: string
    /** The button's size, `medium` by default */
    size?: 'small' | 'medium'
    onSaveAvatar?: (filepath: string) => void
}

export const UserAvatarEditor: React.FC<UserAvatarProps> = ({ label, size = 'medium', onSaveAvatar }) => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const inputFile = useRef<HTMLInputElement>(null)
    const imageRef = useRef<HTMLImageElement>(null)

    const [uploadAvatar, { data: uploadData, isLoading: uploadLoading }] = API.useUsersPostUploadAvatarMutation()
    const [cropAvatar, { data: cropData, isLoading: cropLoading, isSuccess }] = API.useUsersPatchCropAvatarMutation()

    const [uploadedFile, setUploadedFile] = useState<ApiType.Users.UploadAvatarResponse>()
    const [coverDialogOpen, setCoverDialogOpen] = useState<boolean>(false)
    const [imageCropData, setImageCropData] = useState<Crop>()
    const [imageSizes, setImageSizes] = useState<ImageSizesType>()

    const disabled =
        cropLoading || uploadLoading || !imageCropData?.width || !imageCropData.height || !imageSizes || !uploadedFile

    const handleChangeCoverClick = () => {
        dispatch(toggleOverlay(true))
        setCoverDialogOpen(true)
    }

    const handleCoverDialogClose = () => {
        dispatch(toggleOverlay(false))
        setCoverDialogOpen(false)
        setImageSizes(undefined)
        setUploadedFile(undefined)
    }

    const handleSaveCover = async () => {
        if (!imageSizes || !uploadedFile || disabled) {
            return
        }

        await cropAvatar({
            filename: uploadedFile.filename,
            height: Math.round(imageSizes.realHeight * ((imageCropData.height || 0) / 100)),
            width: Math.round(imageSizes.realWidth * ((imageCropData.width || 0) / 100)),
            x: Math.round(imageSizes.realWidth * ((imageCropData.x || 0) / 100)),
            y: Math.round(imageSizes.realHeight * ((imageCropData.y || 0) / 100))
        })
    }

    const handlePhotoUploadClick = () => {
        inputFile.current?.click()
    }

    // A file the API would refuse is not sent: the visitor learns what fits at once
    const uploadFile = async (file?: File) => {
        if (!file) {
            return
        }

        if (!AVATAR_ACCEPT_TYPES.includes(file.type) || file.size > AVATAR_MAX_SIZE) {
            void dispatch(
                Notify({
                    id: 'avatarUploadRejected',
                    message: t('avatar-upload-rejected'),
                    type: 'error'
                })
            )
            return
        }

        const formData = new FormData()

        formData.append('avatar', file)

        await uploadAvatar({ formData })
    }

    const handleSelectedFilesUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]

        // The same file can be picked again after a refusal
        event.target.value = ''

        await uploadFile(file)
    }

    // Select a photo to upload
    const handleImageLoad = () => {
        if (imageSizes || !imageRef.current) {
            return
        }

        const sizes = {
            halfRealSize: 0,
            halfSize: 0,
            height: imageRef.current.height,
            ratioHeight: 0,
            ratioWidth: 0,
            realHeight: imageRef.current.naturalHeight,
            realWidth: imageRef.current.naturalWidth,
            width: imageRef.current.width
        }

        sizes.ratioWidth = sizes.realWidth / sizes.width
        sizes.ratioHeight = sizes.realHeight / sizes.height
        sizes.halfSize = Math.min(sizes.width, sizes.height)
        sizes.halfRealSize = Math.min(sizes.realWidth, sizes.realHeight)

        setImageCropData({
            height: (sizes.halfSize / sizes.height) * 100, // 50% of height
            unit: '%',
            width: (sizes.halfSize / sizes.width) * 100, // 50% of width
            x: 0,
            y: 0
        })

        setImageSizes(sizes)
    }

    useEffect(() => {
        handleCoverDialogClose()
        onSaveAvatar?.(cropData?.filepath || '')
    }, [isSuccess])

    // The photo was uploaded to a temporary directory
    useEffect(() => {
        if (uploadData?.filename) {
            setUploadedFile(uploadData)
        }
    }, [uploadData])

    return (
        <>
            <Button
                size={size}
                icon={'Photo'}
                mode={'secondary'}
                label={label ?? t('avatar')}
                onClick={handleChangeCoverClick}
            />

            <Dialog
                contentHeight={'500px'}
                maxWidth={'700px'}
                title={!uploadedFile ? t('upload') : t('save')}
                open={coverDialogOpen}
                backLinkCaption={t('back')}
                showBackLink={!!uploadedFile}
                onBackClick={() => {
                    setUploadedFile(undefined)
                    setImageSizes(undefined)
                }}
                onCloseDialog={handleCoverDialogClose}
            >
                <>
                    {!uploadLoading ? (
                        <div className={styles.innerContainer}>
                            {!uploadedFile ? (
                                <>
                                    <input
                                        ref={inputFile}
                                        style={{ display: 'none' }}
                                        type={'file'}
                                        accept={AVATAR_ACCEPT_TYPES.join(', ')}
                                        onChange={handleSelectedFilesUpload}
                                    />

                                    <UploadZone
                                        className={styles.uploadZone}
                                        title={t('avatar-upload-title')}
                                        hint={t('avatar-upload-hint')}
                                        disabled={uploadLoading}
                                        onClick={handlePhotoUploadClick}
                                        onDrop={(files) => void uploadFile(files[0])}
                                    />
                                </>
                            ) : (
                                <ReactCrop
                                    circularCrop={true}
                                    crop={imageCropData}
                                    aspect={1}
                                    minHeight={
                                        // 50% in px of width
                                        imageSizes ? imageSizes.halfRealSize / 2 / imageSizes.ratioHeight : 500
                                    }
                                    minWidth={
                                        // 50% in px of height
                                        imageSizes ? imageSizes.halfRealSize / 2 / imageSizes.ratioWidth : 500
                                    }
                                    onChange={(c, p) => setImageCropData(p)}
                                >
                                    {/* eslint-disable-next-line next/no-img-element */}
                                    <img
                                        ref={imageRef}
                                        src={`${IMG_HOST}${uploadedFile.filepath}`}
                                        onLoad={handleImageLoad}
                                        alt={''}
                                        style={{
                                            height: '100%'
                                        }}
                                    />
                                </ReactCrop>
                            )}
                        </div>
                    ) : (
                        <div className={styles.loader}>
                            <Spinner />
                        </div>
                    )}

                    <div className={styles.dialogFooter}>
                        <Button
                            mode={'primary'}
                            label={t('save')}
                            onClick={handleSaveCover}
                            disabled={disabled}
                        />
                    </div>
                </>
            </Dialog>
        </>
    )
}
