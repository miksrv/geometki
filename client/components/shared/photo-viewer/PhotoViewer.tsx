import React, { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn, Icon, Spinner } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { useAppSelector } from '@/app/store'

import { isAbsoluteUrl, resolveImageUrl } from '../photo-lightbox/utils'

import styles from './styles.module.sass'

const PhotoLightbox = dynamic(
    () => import('@/components/shared/photo-lightbox/PhotoLightbox').then((m) => ({ default: m.PhotoLightbox })),
    { ssr: false }
)

export type PhotoViewerState = { mode: 'grid' | 'single'; index: number } | null

interface PhotoViewerProps {
    photos: ApiModel.Photo[]
    /** The place: the heading of the grid, the photos are named after it */
    title?: string
    /** Closed (`null`), all the photos as a grid, or one photo at `index` */
    state: PhotoViewerState
    onStateChange: (state: PhotoViewerState) => void
    /** Signed-in visitors get the tools on the tiles; the server decides what they may change */
    canEdit?: boolean
    /** A photo being rotated or deleted: a spinner over its tile */
    loadingId?: string
    onRotate?: (photo: ApiModel.Photo) => void
    onDelete?: (photo: ApiModel.Photo) => void
    onAddClick?: () => void
}

/**
 * The photos of a place in one dark full-screen viewer, two modes of it: all the photos as a
 * grid (a header with the count, "Добавить", the close button; rotate and delete on the tiles,
 * "ваше фото" on the visitor's own) and one photo at a time — the lightbox with zoom, swipes
 * and the author, its toolbar leading back to the grid. Every way into the photos of the
 * place page leads here: "+N" and the tiles of the mosaic, the phone carousel and its counter.
 */
export const PhotoViewer: React.FC<PhotoViewerProps> = ({
    photos,
    title,
    state,
    onStateChange,
    canEdit,
    loadingId,
    onRotate,
    onDelete,
    onAddClick
}) => {
    const { t } = useTranslation()
    const titleId = useId()
    const gridRef = useRef<HTMLDivElement>(null)

    const userId = useAppSelector((store) => store.auth.user?.id)

    // The portal target exists on the client only
    const [mounted, setMounted] = useState<boolean>(false)
    // The lightbox reports the photo shown, so "Все фото" comes back to the grid at it
    const [current, setCurrent] = useState<number>(0)

    useEffect(() => setMounted(true), [])

    useEffect(() => {
        if (state?.mode === 'single') {
            setCurrent(state.index)
        }
    }, [state])

    const gridOpen = mounted && state?.mode === 'grid' && !!photos.length

    useEffect(() => {
        if (!gridOpen) {
            return
        }

        const previouslyFocused = document.activeElement as HTMLElement | null
        const overflow = document.body.style.overflow

        document.body.style.overflow = 'hidden'
        // Back from a photo, the grid is at that photo: focused and scrolled into view
        const cell = gridRef.current?.querySelector<HTMLElement>(`[data-index="${state?.index ?? 0}"]`)
        cell?.focus()
        cell?.scrollIntoView?.({ block: 'nearest' })

        const handleKeyDown = (event: KeyboardEvent) => {
            // A confirmation dialog over the grid closes first
            if (
                event.key === 'Escape' &&
                !document.querySelector('[role="dialog"][aria-modal="true"]:not([data-viewer])')
            ) {
                onStateChange(null)
            }
        }

        document.addEventListener('keydown', handleKeyDown)

        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            document.body.style.overflow = overflow
            previouslyFocused?.focus?.()
        }
    }, [gridOpen])

    const labels = {
        add: t('add-photo', { defaultValue: 'Добавить фото' }),
        all: t('all-photos-count', { count: photos.length, defaultValue: 'Все фото ({{count}})' }),
        close: t('close', { defaultValue: 'Закрыть' })
    }

    const photoName = (index: number) =>
        `${title ?? ''} — ${t('photo', { defaultValue: 'Фотография' }).toLowerCase()} ${index + 1}`

    const addButton = onAddClick && (
        <button
            key={'add'}
            type={'button'}
            className={styles.button}
            onClick={() => {
                onStateChange(null)
                onAddClick()
            }}
        >
            <Icon name={'Camera'} />
            <span>{labels.add}</span>
        </button>
    )

    return (
        <>
            {state?.mode === 'single' && !!photos.length && (
                <PhotoLightbox
                    photos={photos}
                    photoIndex={state.index}
                    showLightbox={true}
                    showCounter={true}
                    toolbarButtons={[
                        <button
                            key={'grid'}
                            type={'button'}
                            className={cn(styles.button, styles.toolbarButton)}
                            onClick={() => onStateChange({ mode: 'grid', index: current })}
                        >
                            <Icon name={'Photo'} />
                            <span>{labels.all}</span>
                        </button>,
                        addButton &&
                            React.cloneElement(addButton, { className: cn(styles.button, styles.toolbarButton) })
                    ].filter(Boolean)}
                    onIndexChange={setCurrent}
                    onCloseLightBox={() => onStateChange(null)}
                />
            )}

            {gridOpen &&
                createPortal(
                    <div
                        className={styles.viewer}
                        role={'dialog'}
                        aria-modal={true}
                        aria-labelledby={titleId}
                        data-viewer={true}
                    >
                        <header className={styles.header}>
                            <h2
                                id={titleId}
                                className={styles.title}
                            >
                                {title && <span className={styles.place}>{title}</span>}
                                <span className={title ? styles.count : undefined}>{labels.all}</span>
                            </h2>
                            {addButton}
                            <button
                                type={'button'}
                                className={cn(styles.button, styles.icon)}
                                aria-label={labels.close}
                                onClick={() => onStateChange(null)}
                            >
                                <Icon name={'Close'} />
                            </button>
                        </header>

                        {canEdit && (
                            <p className={styles.hint}>
                                {t('photos-viewer-hint', {
                                    defaultValue: 'Наведите на фото, чтобы повернуть или удалить его'
                                })}
                            </p>
                        )}

                        <div
                            ref={gridRef}
                            className={styles.grid}
                        >
                            {photos.map((photo, index) => {
                                const own = !!userId && photo.author?.id === userId

                                return (
                                    <div
                                        key={photo.id}
                                        className={styles.cell}
                                    >
                                        <button
                                            type={'button'}
                                            className={styles.open}
                                            data-index={index}
                                            aria-label={photoName(index)}
                                            onClick={() => onStateChange({ mode: 'single', index })}
                                        >
                                            <Image
                                                src={resolveImageUrl(photo.preview) ?? ''}
                                                unoptimized={isAbsoluteUrl(photo.preview)}
                                                alt={photoName(index)}
                                                width={700}
                                                height={500}
                                                sizes={'(max-width: 768px) 50vw, 320px'}
                                            />
                                        </button>

                                        {own && (
                                            <span className={styles.own}>
                                                {t('photos-viewer-own', { defaultValue: 'ваше фото' })}
                                            </span>
                                        )}

                                        {photo.id === loadingId && (
                                            <span className={styles.loader}>
                                                <Spinner />
                                            </span>
                                        )}

                                        {canEdit && (
                                            <span className={styles.tools}>
                                                {!photo.external && onRotate && (
                                                    <button
                                                        type={'button'}
                                                        className={styles.tool}
                                                        aria-label={t('to-turn', { defaultValue: 'Повернуть' })}
                                                        title={t('to-turn', { defaultValue: 'Повернуть' })}
                                                        disabled={!!loadingId}
                                                        onClick={() => onRotate(photo)}
                                                    >
                                                        <Icon name={'Rotate'} />
                                                    </button>
                                                )}
                                                {onDelete && (
                                                    <button
                                                        type={'button'}
                                                        className={styles.tool}
                                                        aria-label={t('delete', { defaultValue: 'Удалить' })}
                                                        title={t('delete', { defaultValue: 'Удалить' })}
                                                        disabled={!!loadingId}
                                                        onClick={() => onDelete(photo)}
                                                    >
                                                        <Icon name={'Close'} />
                                                    </button>
                                                )}
                                            </span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>,
                    document.body
                )}
        </>
    )
}
