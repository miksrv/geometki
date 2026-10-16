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
import { PhotoViewer } from '../photo-viewer'
import type { PhotoViewerState } from '../photo-viewer/PhotoViewer'
import { Section } from '../section'

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
// Mosaic: one big tile (half of the main column, ~450px) and four small ones, a strip of 200px tiles on phones
const MOSAIC_COUNT = 5
const MOSAIC_SIZES = '(max-width: 768px) 200px, 450px'

interface PhotoGalleryProps extends ContainerProps {
    photos?: ApiModel.Photo[]
    hideActions?: boolean
    /** Show every photo at once, without the "more photos" button (a page of photos) */
    showAll?: boolean
    /**
     * `grid` (default) — rows of 4:3 tiles in a Container, the rest behind "more photos";
     * `mosaic` — a boxless Section with one big and four small tiles, the last one carrying
     * "+N" into the lightbox (the place page, DESIGN.md → Place page)
     */
    variant?: 'grid' | 'mosaic'
    /**
     * Mosaic: the full-screen viewer (`PhotoViewer`) — closed, the grid of all the photos or one
     * photo. Controlled when given: the place page opens it from the hero carousel too
     */
    viewer?: PhotoViewerState
    onViewerChange?: (state: PhotoViewerState) => void
    uploadingPhotos?: string[]
    onPhotoDelete?: (photos: ApiModel.Photo[]) => void
    onPhotoUploadClick?: () => void
}

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({
    photos,
    hideActions,
    showAll,
    variant = 'grid',
    viewer: viewerProp,
    onViewerChange,
    uploadingPhotos,
    onPhotoDelete,
    onPhotoUploadClick,
    ...props
}) => {
    const { t } = useTranslation()
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
    // Mosaic only: the viewer, with the rotate / delete tools on the tiles of its grid
    const [viewerState, setViewerState] = useState<PhotoViewerState>(null)
    const viewer = viewerProp !== undefined ? viewerProp : viewerState

    const setViewer = (state: PhotoViewerState) => {
        setViewerState(state)
        onViewerChange?.(state)
    }

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

    // `more`: the last mosaic tile, it opens the whole grid instead of the lightbox
    const renderPhotoItem = (photo: ApiModel.Photo, listIndex: number, more?: number) => (
        <li
            key={photo.id}
            className={styles.photoItem}
        >
            {!!more && (
                <span
                    className={styles.more}
                    aria-hidden={true}
                >{`+${more}`}</span>
            )}
            {photo.id === photoLoadingID && (
                <div className={styles.loader}>
                    <Spinner />
                </div>
            )}

            <Link
                className={styles.link}
                href={resolveImageUrl(photo.full) ?? ''}
                title={
                    more
                        ? t('all-photos-count', {
                              count: localPhotos.length,
                              defaultValue: 'Все фото ({{count}})'
                          })
                        : `${photo.title}. ${t('photo', { defaultValue: 'Фотография' })} ${listIndex + 1}`
                }
                aria-expanded={more ? false : undefined}
                onClick={(event) => {
                    event.preventDefault()

                    if (more) {
                        setViewer({ index: listIndex, mode: 'grid' })
                    } else if (variant === 'mosaic') {
                        setViewer({ index: listIndex, mode: 'single' })
                    } else {
                        setLightboxPhotoIndex(listIndex)
                    }
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
                    sizes={variant === 'mosaic' ? MOSAIC_SIZES : TILE_SIZES}
                    style={{ width: '100%', height: '100%' }}
                />
            </Link>

            {!hideActions && isAuth && variant !== 'mosaic' && (
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
                        <li data-negative={true}>
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

    const dialogs = (
        <>
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
        </>
    )

    if (variant === 'mosaic') {
        // Uploads in flight take tiles first; photos fill the rest of the five. While the
        // photos do not fill them, the free tile invites to add one; a full mosaic carries
        // a small "Добавить фото" pill over the big photo instead.
        const uploadingTiles = uploadingPhotos?.slice(0, MOSAIC_COUNT) ?? []
        const mosaicPhotos = localPhotos.slice(0, Math.max(0, MOSAIC_COUNT - uploadingTiles.length))
        const hiddenCount = localPhotos.length - mosaicPhotos.length
        const filledCount = uploadingTiles.length + mosaicPhotos.length
        const addTile = !!onPhotoUploadClick && filledCount < MOSAIC_COUNT
        const tileCount = filledCount + (addTile ? 1 : 0)

        const addLabel = t('add-photo', { defaultValue: 'Добавить фото' })
        // The photos are named after their place: the viewer heading
        const placeTitle = localPhotos[0]?.title

        return (
            <Section
                id={props.id}
                title={props.title}
                titleHidden={true}
                footer={props.footer}
                className={props.className}
            >
                {isEmptyPhotoList ? (
                    onPhotoUploadClick ? (
                        <button
                            type={'button'}
                            className={cn(styles.addTile, styles.addZone)}
                            onClick={onPhotoUploadClick}
                        >
                            <Icon name={'Camera'} />
                            <strong>{t('photos-empty-title', { defaultValue: 'Фото этого места пока нет' })}</strong>
                            <span>
                                {t('photos-empty-hint', {
                                    defaultValue: 'Добавьте первое — нажмите или перетащите файлы сюда'
                                })}
                            </span>
                        </button>
                    ) : (
                        <div className={styles.emptyLine}>
                            {t('no-photos-here-yet', { defaultValue: 'Тут пока нет фотографий' })}
                        </div>
                    )
                ) : (
                    <div className={styles.mosaicWrap}>
                        <ul
                            className={styles.mosaic}
                            data-count={tileCount}
                        >
                            {uploadingTiles.map((photo) => (
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
                            {mosaicPhotos.map((photo, index) =>
                                renderPhotoItem(
                                    photo,
                                    index,
                                    index === mosaicPhotos.length - 1 && hiddenCount > 0 ? hiddenCount : undefined
                                )
                            )}
                            {addTile && (
                                <li className={styles.photoItem}>
                                    <button
                                        type={'button'}
                                        className={styles.addTile}
                                        onClick={onPhotoUploadClick}
                                    >
                                        <Icon name={'Camera'} />
                                        <strong>{addLabel}</strong>
                                        <span>{t('photos-drop-short', { defaultValue: 'или перетащите сюда' })}</span>
                                    </button>
                                </li>
                            )}
                        </ul>

                        {!!onPhotoUploadClick && !addTile && (
                            <button
                                type={'button'}
                                className={styles.addPill}
                                onClick={onPhotoUploadClick}
                            >
                                <Icon name={'Camera'} />
                                {addLabel}
                            </button>
                        )}
                    </div>
                )}
                <PhotoViewer
                    photos={localPhotos}
                    title={placeTitle}
                    state={viewer}
                    canEdit={isAuth && !hideActions}
                    loadingId={photoLoadingID}
                    onStateChange={setViewer}
                    onRotate={(photo) => void handleRotateClick(photo.id, photo.placeId === 'temporary')}
                    onDelete={(photo) => handleRemoveClick(photo.id)}
                    onAddClick={onPhotoUploadClick}
                />
                {dialogs}
            </Section>
        )
    }

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

            {dialogs}
        </Container>
    )
}
