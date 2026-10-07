import React, { LegacyRef, RefObject, useEffect, useImperativeHandle, useRef, useState } from 'react'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel } from '@/api'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch } from '@/app/store'
import { getErrorMessage } from '@/utils/api'

/** Image types the API accepts (`mime_in` rule of the photo upload endpoints) */
export const PHOTO_ACCEPT_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

/** Upload size limit of the API (`max_size[photo,10240]`), bytes */
export const PHOTO_MAX_SIZE = 10 * 1024 * 1024

export interface PhotoUploaderHandle {
    /** Adds files to the upload queue (e.g. dropped onto the gallery) */
    upload: (files: File[]) => void
}

interface QueueItem {
    file: File
    preview: string
}

interface PhotoUploaderProps {
    placeId?: string
    onSelectFiles?: (uploadingPhotosData?: string[]) => void
    onUploadPhoto?: (photo: ApiModel.Photo) => void
    fileInputRef?: RefObject<HTMLInputElement | null>
    /** Receives the imperative `upload(files)` for files that don't come from the file input */
    uploaderRef?: RefObject<PhotoUploaderHandle | null>
}

/**
 * Hidden file input plus an upload queue: photos are sent one by one, a failed file is
 * reported and skipped, and files added while the queue runs are appended to it.
 */
export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
    placeId,
    onSelectFiles,
    onUploadPhoto,
    fileInputRef,
    uploaderRef
}) => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const [queue, setQueue] = useState<QueueItem[]>([])
    const queueRef = useRef(queue)
    queueRef.current = queue
    const uploadingRef = useRef(false)
    // The place page keeps this component when moving to another place: an upload that finishes
    // after that must not land in the new place's gallery
    const placeIdRef = useRef(placeId)
    placeIdRef.current = placeId

    const [uploadPhoto] = API.usePhotoPostUploadMutation()

    const notifyError = (message: string) =>
        void dispatch(
            Notify({
                id: 'uploadPhotoError',
                title: '',
                message,
                type: 'error'
            })
        )

    const enqueue = (files: File[]) => {
        if (!placeId || !files.length) {
            return
        }

        const accepted = files.filter((file) => PHOTO_ACCEPT_TYPES.includes(file.type) && file.size <= PHOTO_MAX_SIZE)

        if (accepted.length < files.length) {
            notifyError(
                t('photo-upload-rejected', {
                    defaultValue: 'Можно загрузить только фотографии JPG, PNG, GIF или WEBP размером до 10 МБ'
                })
            )
        }

        setQueue((prev) => [...prev, ...accepted.map((file) => ({ file, preview: URL.createObjectURL(file) }))])
    }

    useImperativeHandle(uploaderRef, () => ({ upload: enqueue }), [placeId])

    const handleSelectedFilesUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        enqueue(Array.from(event.target.files ?? []))
        // Lets the same file be picked again later
        event.target.value = ''
    }

    // Uploads the head of the queue; the next one starts when it is removed from the queue
    useEffect(() => {
        const item = queue[0]

        if (!item || uploadingRef.current) {
            return
        }

        uploadingRef.current = true

        const formData = new FormData()
        formData.append('photo', item.file)

        const itemPlaceId = placeId

        void uploadPhoto({ count: queue.length, formData, place: itemPlaceId })
            .unwrap()
            .then((photo) => {
                if (placeIdRef.current === itemPlaceId) {
                    onUploadPhoto?.(photo)
                }
            })
            .catch((error) => notifyError(getErrorMessage(error) ?? ''))
            .finally(() => {
                URL.revokeObjectURL(item.preview)
                uploadingRef.current = false
                // By identity: the queue may have been reset and refilled meanwhile
                setQueue((prev) => prev.filter((queued) => queued !== item))
            })
    }, [queue])

    useEffect(() => {
        // The item being uploaded revokes its own preview when done
        queueRef.current.slice(uploadingRef.current ? 1 : 0).forEach(({ preview }) => URL.revokeObjectURL(preview))
        setQueue([])
    }, [placeId])

    useEffect(() => {
        onSelectFiles?.(queue.map(({ preview }) => preview).reverse())
    }, [queue])

    return (
        <input
            multiple={true}
            ref={fileInputRef as LegacyRef<HTMLInputElement> | undefined}
            style={{ display: 'none' }}
            type={'file'}
            accept={PHOTO_ACCEPT_TYPES.join(', ')}
            onChange={handleSelectedFilesUpload}
        />
    )
}
