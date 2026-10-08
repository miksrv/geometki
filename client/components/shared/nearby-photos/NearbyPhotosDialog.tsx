import React, { useMemo, useState } from 'react'
import { Button, cn, Dialog, Icon, Skeleton, Spinner } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel } from '@/api'
import { APIPastvu } from '@/api/apiPastvu'
import { APIWikimediaCommons } from '@/api/apiWikimediaCommons'
import { openAuthDialog } from '@/app/applicationSlice'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { getErrorMessage } from '@/utils/api'
import { formatDistance } from '@/utils/geo'

import { buildLinksMap, buildNearbyPhotos, NearbyPhoto } from './utils'

import styles from './styles.module.sass'

const PhotoLightbox = dynamic(
    () => import('@/components/shared/photo-lightbox/PhotoLightbox').then((m) => ({ default: m.PhotoLightbox })),
    { ssr: false }
)

/** Meters around the place: the photo positions are rough, so first the close ones, then wider */
const RADIUS_NEAR = 500
const RADIUS_WIDE = 2000

/** A search radius is a round number: «500 м», «2 км», not «2,00 км» as a measured distance */
const formatRadius = (meters: number, locale: string, kmUnit: string): string =>
    meters < 1000 ? formatDistance(meters, locale) : `${meters / 1000} ${kmUnit}`

type SourceFilter = 'all' | ApiModel.PhotoExternalSource

interface NearbyPhotosDialogProps {
    place: { id: string; lat: number; lon: number; title?: string }
    open: boolean
    onClose: () => void
    /** A photo was linked: the gallery of the place can show it at once */
    onLink?: (photo: ApiModel.Photo) => void
    /** A photo was unlinked, by its link id */
    onUnlink?: (linkId: string) => void
}

/**
 * "Фото рядом": Wikimedia Commons and PastVu photos around a place, nearest first.
 * The positions of these photos are rough, so the user decides by the picture itself:
 * a click on a tile links the photo to the place or unlinks it, without a save button.
 */
export const NearbyPhotosDialog: React.FC<NearbyPhotosDialogProps> = ({ place, open, onClose, onLink, onUnlink }) => {
    const { t, i18n } = useTranslation()
    const dispatch = useAppDispatch()
    const kmUnit = t('nearby-photos_km', { defaultValue: 'км' })

    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const [radius, setRadius] = useState<number>(RADIUS_NEAR)
    const [filter, setFilter] = useState<SourceFilter>('all')
    const [pending, setPending] = useState<string[]>([])
    const [lightboxIndex, setLightboxIndex] = useState<number>()

    const commons = APIWikimediaCommons.useGetNearbyQuery({ lat: place.lat, lon: place.lon, radius }, { skip: !open })
    const pastvu = APIPastvu.useGetNearestQuery(
        // PastVu gives at most 30 nearest photos
        { distance: radius, geo: [place.lat, place.lon], limit: 30 },
        { skip: !open }
    )
    const { data: linksData } = API.useExternalPhotosGetListQuery({ place: place.id }, { skip: !open })

    const [linkPhoto] = API.useExternalPhotosPostLinkMutation()
    const [unlinkPhoto] = API.useExternalPhotosDeleteLinkMutation()

    // Results of the clicks in this dialog, the photo key → the link id or null when unlinked:
    // a tile changes at once, without waiting for the list refetch, so a second click is right too
    const [overrides, setOverrides] = useState<Map<string, string | null>>(new Map())

    const links = useMemo(() => {
        const merged = buildLinksMap(linksData?.items)

        overrides.forEach((linkId, key) => (linkId ? merged.set(key, linkId) : merged.delete(key)))

        return merged
    }, [linksData, overrides])

    const setOverride = (key: string, linkId: string | null) =>
        setOverrides((current) => new Map(current).set(key, linkId))

    const photos = useMemo(
        () =>
            buildNearbyPhotos(place, commons.data, pastvu.data).filter(
                (photo) => filter === 'all' || photo.source === filter
            ),
        [place, commons.data, pastvu.data, filter]
    )

    const loading = commons.isFetching || pastvu.isFetching
    const linkedCount = links.size

    const notifyError = (error: unknown) =>
        dispatch(
            Notify({
                id: 'nearbyPhotoError',
                message: getErrorMessage(error),
                type: 'error'
            })
        )

    const handleToggle = async (photo: NearbyPhoto) => {
        if (!isAuth) {
            dispatch(openAuthDialog())
            return
        }

        if (pending.includes(photo.key)) {
            return
        }

        setPending((keys) => [...keys, photo.key])

        try {
            const linkId = links.get(photo.key)

            if (linkId) {
                await unlinkPhoto({ id: linkId, placeId: place.id }).unwrap()
                setOverride(photo.key, null)
                onUnlink?.(linkId)
            } else {
                const linked = await linkPhoto({
                    externalId: photo.externalId,
                    placeId: place.id,
                    source: photo.source
                }).unwrap()
                setOverride(photo.key, linked.id)
                onLink?.(linked)
            }
        } catch (error) {
            void notifyError(error)
        } finally {
            setPending((keys) => keys.filter((key) => key !== photo.key))
        }
    }

    const sourceName = (source: ApiModel.PhotoExternalSource) => (source === 'wikimedia' ? 'Commons' : 'PastVu')

    const filters: Array<{ value: SourceFilter; label: string }> = [
        { label: t('nearby-photos_all', { defaultValue: 'Все' }), value: 'all' },
        { label: 'Wikimedia Commons', value: 'wikimedia' },
        { label: 'PastVu', value: 'pastvu' }
    ]

    return (
        <Dialog
            open={open}
            title={t('nearby-photos_title', { defaultValue: 'Фото рядом' })}
            maxWidth={'760px'}
            onCloseDialog={onClose}
        >
            <div className={styles.toolbar}>
                <div
                    className={styles.filters}
                    role={'tablist'}
                >
                    {filters.map(({ value, label }) => (
                        <Button
                            key={value}
                            role={'tab'}
                            aria-selected={filter === value}
                            mode={filter === value ? 'primary' : 'secondary'}
                            size={'small'}
                            label={label}
                            onClick={() => setFilter(value)}
                        />
                    ))}
                </div>

                <span className={styles.summary}>
                    {t('nearby-photos_summary', {
                        defaultValue: 'Добавлено: {{count}} · до {{radius}}',
                        count: linkedCount,
                        radius: formatRadius(radius, i18n.language, kmUnit)
                    })}
                </span>
            </div>

            {loading && !photos.length ? (
                <ul className={styles.grid}>
                    {Array.from({ length: 6 }).map((_, index) => (
                        <li
                            key={index}
                            className={styles.tile}
                        >
                            <Skeleton style={{ height: '100%', width: '100%' }} />
                        </li>
                    ))}
                </ul>
            ) : !photos.length ? (
                <div className={styles.empty}>
                    {t('nearby-photos_empty', { defaultValue: 'Рядом с этим местом фотографий не нашлось' })}
                </div>
            ) : (
                <ul className={styles.grid}>
                    {photos.map((photo, index) => {
                        const linked = links.has(photo.key)
                        const isPending = pending.includes(photo.key)

                        return (
                            <li
                                key={photo.key}
                                className={cn(styles.tile, linked && styles.linked)}
                            >
                                <button
                                    type={'button'}
                                    className={styles.toggle}
                                    aria-pressed={linked}
                                    title={
                                        linked
                                            ? t('nearby-photos_unlink', { defaultValue: 'Убрать из фотографий места' })
                                            : t('nearby-photos_link', { defaultValue: 'Добавить в фотографии места' })
                                    }
                                    onClick={() => void handleToggle(photo)}
                                >
                                    <Image
                                        src={photo.preview}
                                        alt={photo.title ?? ''}
                                        fill={true}
                                        sizes={'240px'}
                                        // External hosts are not allowed for the image optimizer
                                        unoptimized={true}
                                    />
                                </button>

                                <span className={cn(styles.source, styles[photo.source])}>
                                    {sourceName(photo.source)}
                                    {photo.year ? ` · ${photo.year}` : ''}
                                </span>

                                <span className={styles.check}>
                                    {isPending ? <Spinner /> : linked && <Icon name={'CheckCircle'} />}
                                </span>

                                <span className={styles.distance}>{formatDistance(photo.distance, i18n.language)}</span>

                                <button
                                    type={'button'}
                                    className={styles.zoom}
                                    title={t('nearby-photos_zoom', { defaultValue: 'Посмотреть' })}
                                    onClick={() => setLightboxIndex(index)}
                                >
                                    <Icon name={'Search'} />
                                </button>
                            </li>
                        )
                    })}
                </ul>
            )}

            {radius === RADIUS_NEAR && !loading && (
                <Button
                    className={styles.more}
                    mode={'secondary'}
                    size={'medium'}
                    stretched={true}
                    label={t('nearby-photos_wider', {
                        defaultValue: 'Искать дальше (до {{radius}})',
                        radius: formatRadius(RADIUS_WIDE, i18n.language, kmUnit)
                    })}
                    onClick={() => setRadius(RADIUS_WIDE)}
                />
            )}

            {typeof lightboxIndex === 'number' && (
                <PhotoLightbox
                    photos={photos}
                    photoIndex={lightboxIndex}
                    showLightbox={true}
                    onCloseLightBox={() => setLightboxIndex(undefined)}
                />
            )}
        </Dialog>
    )
}
