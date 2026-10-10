import React, { useEffect, useState } from 'react'
import { Button, cn, Icon, Popout } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel } from '@/api'
import { openAuthDialog } from '@/app/applicationSlice'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { AddToCollectionButton, BookmarkButton, MapLinks, WasHereButton } from '@/components/shared'
import { ScreenSpinner } from '@/components/ui'

import styles from './styles.module.sass'

const ConfirmationDialog = dynamic(() => import('@/components/shared/confirmation-dialog/ConfirmationDialog'), {
    ssr: false
})

// react-share is client-only and the popout content renders on open, so no placeholder is needed
const ShareButtons = dynamic(() => import('./ShareButtons'), { ssr: false })

interface PlaceActionsProps {
    place?: ApiModel.Place
    placeUrl: string
    onPhotoUploadClick?: (event?: React.MouseEvent) => void
    onChangePlaceCoverClick?: (event?: React.MouseEvent) => void
}

/**
 * The toolbar attached to the bottom of the cover: one strip of small buttons, "На карте" the
 * only primary one, the contributor actions (photo, cover, edit, delete) in the "⋯" menu on
 * the right; on phones the buttons wrap into short rows (DESIGN.md → Place page).
 */
export const PlaceActions: React.FC<PlaceActionsProps> = ({
    place,
    placeUrl,
    onPhotoUploadClick,
    onChangePlaceCoverClick
}) => {
    const router = useRouter()
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const isAuth = useAppSelector((state) => state.auth.isAuth)
    const userRole = useAppSelector((state) => state.auth.user?.role)

    const [removePlace, { isLoading: removeLoading, isSuccess: removeSuccess }] = API.usePlaceDeleteMutation()

    const [showRemoveDialog, setShowRemoveDialog] = useState<boolean>(false)
    const [nativeShare, setNativeShare] = useState<boolean>(false)

    const mapLink = `/map#${place?.lat},${place?.lon},14`

    const handleEditPlaceClick = (event: React.MouseEvent) => {
        if (!isAuth) {
            event.preventDefault()
            dispatch(openAuthDialog())
        }
    }

    const handleNativeShare = () => {
        void navigator.share({ title: place?.title, url: placeUrl }).catch(() => undefined)
    }

    const handleCopyLink = async () => {
        await navigator.clipboard.writeText(placeUrl)

        void dispatch(
            Notify({
                id: 'placeLinkCopied',
                message: t('link-copied', { defaultValue: 'Ссылка скопирована' }),
                type: 'success'
            })
        )
    }

    // Decided on the client only: the server HTML must match the first client render
    useEffect(() => {
        setNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
    }, [])

    useEffect(() => {
        if (removeSuccess) {
            void router.push('/places')
        }
    }, [removeSuccess])

    const routeMenu = (
        <Popout
            closeOnChildrenClick={true}
            trigger={
                <Button
                    mode={'secondary'}
                    size={'small'}
                    icon={'Compass'}
                    label={t('place-route', { defaultValue: 'Маршрут' })}
                />
            }
        >
            <ul className={cn('contextListMenu', styles.routeList)}>
                <MapLinks
                    title={place?.title}
                    lat={place?.lat ?? 0}
                    lon={place?.lon ?? 0}
                    showTitle={true}
                    asListItem={true}
                />
            </ul>
        </Popout>
    )

    const shareButton = nativeShare ? (
        <Button
            mode={'secondary'}
            size={'small'}
            icon={'External'}
            label={t('share', { defaultValue: 'Поделиться' })}
            onClick={handleNativeShare}
        />
    ) : (
        <Popout
            trigger={
                <Button
                    mode={'secondary'}
                    size={'small'}
                    icon={'External'}
                    label={t('share', { defaultValue: 'Поделиться' })}
                />
            }
        >
            <div className={styles.sharePopout}>
                <ShareButtons placeUrl={placeUrl} />
                <Button
                    mode={'link'}
                    size={'small'}
                    icon={'Link'}
                    label={t('copy-link', { defaultValue: 'Скопировать ссылку' })}
                    onClick={() => void handleCopyLink()}
                />
            </div>
        </Popout>
    )

    return (
        <>
            {removeLoading && <ScreenSpinner />}

            <div className={styles.actions}>
                <Button
                    mode={'primary'}
                    size={'small'}
                    icon={'Map'}
                    link={mapLink}
                    label={t('open-on-map')}
                />

                {routeMenu}

                <WasHereButton
                    size={'small'}
                    placeId={place?.id}
                    verificationExempt={place?.verificationExempt}
                />

                <BookmarkButton
                    size={'small'}
                    placeId={place?.id}
                    count={place?.bookmarks}
                />

                <AddToCollectionButton
                    size={'small'}
                    placeId={place?.id}
                />

                {shareButton}

                <Popout
                    className={styles.menu}
                    closeOnChildrenClick={true}
                    trigger={
                        <Button
                            icon={'VerticalDots'}
                            size={'small'}
                            mode={'secondary'}
                            tooltip={t('place_menu', { defaultValue: 'Действия с местом' })}
                        />
                    }
                >
                    <ul className={'contextListMenu'}>
                        <li>
                            <button
                                type={'button'}
                                onClick={onPhotoUploadClick}
                            >
                                {/* eslint-disable-next-line react/jsx-max-depth */}
                                <Icon name={'Camera'} />
                                {t('upload-photo')}
                            </button>
                        </li>
                        <li>
                            <button
                                type={'button'}
                                onClick={onChangePlaceCoverClick}
                            >
                                {/* eslint-disable-next-line react/jsx-max-depth */}
                                <Icon name={'Photo'} />
                                {t('change-cover')}
                            </button>
                        </li>
                        <li>
                            <Link
                                href={`/places/${place?.id}/edit`}
                                onClick={handleEditPlaceClick}
                            >
                                {/* eslint-disable-next-line react/jsx-max-depth */}
                                <Icon name={'EditLocation'} />
                                {t('edit')}
                            </Link>
                        </li>
                        {userRole === 'admin' && (
                            <li>
                                <button
                                    type={'button'}
                                    onClick={() => setShowRemoveDialog(true)}
                                >
                                    <Icon name={'Close'} />
                                    {t('delete')}
                                </button>
                            </li>
                        )}
                    </ul>
                </Popout>
            </div>

            {showRemoveDialog && (
                <ConfirmationDialog
                    open={showRemoveDialog}
                    message={t('delete-place-confirmation')}
                    onCancel={() => {
                        setShowRemoveDialog(false)
                    }}
                    onConfirm={async () => {
                        if (place?.id) {
                            void removePlace(place.id)
                        }

                        setShowRemoveDialog(false)
                    }}
                />
            )}
        </>
    )
}
