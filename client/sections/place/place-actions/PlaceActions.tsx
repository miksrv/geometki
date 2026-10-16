import React, { useEffect, useState } from 'react'
import { Button, Icon, IconTypes, Popout } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel } from '@/api'
import { openAuthDialog } from '@/app/applicationSlice'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { AddToCollectionModal, MapLinks, useBookmark, WasHereButton } from '@/components/shared'
import { BottomSheet, ScreenSpinner } from '@/components/ui'

import styles from './styles.module.sass'

const ConfirmationDialog = dynamic(() => import('@/components/shared/confirmation-dialog/ConfirmationDialog'), {
    ssr: false
})

// react-share is client-only and the popout content renders on open, so no placeholder is needed
const ShareButtons = dynamic(() => import('./ShareButtons'), { ssr: false })

type SheetType = 'route' | 'save' | 'share' | 'menu'

interface MenuRowProps {
    icon: IconTypes
    label: string
    /** A link row navigates, a button row acts in place */
    href?: string
    disabled?: boolean
    /** A toggle row: a check on the right while it is on */
    pressed?: boolean
    negative?: boolean
    onClick?: (event: React.MouseEvent) => void
}

/** One row of the `contextListMenu` lists of the actions, the same in a popout and a sheet */
const MenuRow: React.FC<MenuRowProps> = ({ icon, label, href, disabled, pressed, negative, onClick }) => {
    const content = (
        <>
            <Icon name={icon} />
            {label}
            {pressed && (
                <Icon
                    name={'CheckCircle'}
                    className={'contextListMenuCheck'}
                />
            )}
        </>
    )

    return (
        <li data-negative={negative || undefined}>
            {href ? (
                <Link
                    href={href}
                    onClick={onClick}
                >
                    {content}
                </Link>
            ) : (
                <button
                    type={'button'}
                    disabled={disabled}
                    aria-pressed={pressed}
                    onClick={onClick}
                >
                    {content}
                </button>
            )}
        </li>
    )
}

const MenuSeparator: React.FC = () => <li role={'separator'} />

interface PlaceActionsProps {
    place?: ApiModel.Place
    placeUrl: string
    /**
     * `toolbar` — desktop, on the title's line of the hero; `bar` — phones, the bar at the
     * bottom of the screen in place of the bottom navigation, its menus open as sheets
     */
    variant?: 'toolbar' | 'bar'
    onPhotoUploadClick?: (event?: React.MouseEvent) => void
    onNearbyPhotosClick?: () => void
    onChangePlaceCoverClick?: (event?: React.MouseEvent) => void
}

/**
 * The actions of the place, one main path: "Маршрут" is the only primary button (the map of
 * the site and the navigators are its menu), then "Я здесь был(а)", "Сохранить" (bookmarks
 * and collections in one menu), "Поделиться" and "⋯" with the contributor actions (photos,
 * cover, edit, delete). The same set on desktop (`toolbar`) and phones (`bar`).
 */
export const PlaceActions: React.FC<PlaceActionsProps> = ({
    place,
    placeUrl,
    variant = 'toolbar',
    onPhotoUploadClick,
    onNearbyPhotosClick,
    onChangePlaceCoverClick
}) => {
    const router = useRouter()
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const isAuth = useAppSelector((state) => state.auth.isAuth)
    const userRole = useAppSelector((state) => state.auth.user?.role)

    const { bookmarked, loading: bookmarkLoading, toggle: toggleBookmark } = useBookmark(place?.id)

    const [removePlace, { isLoading: removeLoading, isSuccess: removeSuccess }] = API.usePlaceDeleteMutation()

    const [showRemoveDialog, setShowRemoveDialog] = useState<boolean>(false)
    const [collectionsOpen, setCollectionsOpen] = useState<boolean>(false)
    const [sheet, setSheet] = useState<SheetType>()
    const [nativeShare, setNativeShare] = useState<boolean>(false)

    const isBar = variant === 'bar'
    const mapLink = `/map#${place?.lat},${place?.lon},14`

    const labels = {
        menu: t('place_menu', { defaultValue: 'Действия с местом' }),
        route: t('place-route', { defaultValue: 'Маршрут' }),
        save: t('place-save', { defaultValue: 'Сохранить' }),
        share: t('share', { defaultValue: 'Поделиться' })
    }

    const requireAuth = (action: () => void) => {
        if (!isAuth) {
            dispatch(openAuthDialog())
        } else {
            action()
        }
    }

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

    // --- Menu contents: the same rows in a desktop popout and in a phone sheet -------------

    const routeItems = (
        <ul className={'contextListMenu'}>
            <MenuRow
                icon={'Map'}
                href={mapLink}
                label={t('open-on-geometki-map', { defaultValue: 'Карта Геометок' })}
            />
            <MenuSeparator />
            <MapLinks
                title={place?.title}
                lat={place?.lat ?? 0}
                lon={place?.lon ?? 0}
                showTitle={true}
                label={'brand'}
                asListItem={true}
            />
        </ul>
    )

    const saveItems = (
        <ul className={'contextListMenu'}>
            <MenuRow
                icon={'Bookmark'}
                label={t('bookmarks', { defaultValue: 'Закладки' })}
                disabled={!place?.id || bookmarkLoading}
                pressed={bookmarked}
                onClick={() => void toggleBookmark()}
            />
            <MenuRow
                icon={'Layers'}
                label={t('collections_add-to-collection-button', { defaultValue: 'В коллекцию' })}
                disabled={!place?.id}
                onClick={() => requireAuth(() => setCollectionsOpen(true))}
            />
        </ul>
    )

    const shareItems = (
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
    )

    const menuItems = (
        <ul className={'contextListMenu'}>
            <MenuRow
                icon={'Camera'}
                label={t('add-photo', { defaultValue: 'Добавить фото' })}
                onClick={onPhotoUploadClick}
            />
            {onNearbyPhotosClick && (
                <MenuRow
                    icon={'Position'}
                    label={t('photos-link-nearby', { defaultValue: 'Привязать фото рядом' })}
                    onClick={onNearbyPhotosClick}
                />
            )}
            <MenuRow
                icon={'Photo'}
                label={t('change-cover')}
                onClick={onChangePlaceCoverClick}
            />
            <MenuRow
                icon={'EditLocation'}
                href={`/places/${place?.id}/edit`}
                label={t('edit')}
                onClick={handleEditPlaceClick}
            />
            <MenuSeparator />
            <MenuRow
                icon={'Link'}
                label={t('copy-link', { defaultValue: 'Скопировать ссылку' })}
                onClick={() => void handleCopyLink()}
            />
            {userRole === 'admin' && (
                <MenuRow
                    icon={'Close'}
                    label={t('delete')}
                    negative={true}
                    onClick={() => setShowRemoveDialog(true)}
                />
            )}
        </ul>
    )

    const dialogs = (
        <>
            {removeLoading && <ScreenSpinner />}

            <AddToCollectionModal
                placeId={place?.id}
                open={collectionsOpen}
                onClose={() => setCollectionsOpen(false)}
            />

            {showRemoveDialog && (
                <ConfirmationDialog
                    open={showRemoveDialog}
                    message={t('delete-place-confirmation')}
                    onCancel={() => setShowRemoveDialog(false)}
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

    if (isBar) {
        return (
            <>
                <div
                    className={styles.bar}
                    role={'toolbar'}
                    aria-label={labels.menu}
                >
                    <Button
                        mode={'primary'}
                        size={'large'}
                        icon={'Compass'}
                        label={labels.route}
                        className={styles.grow}
                        aria-haspopup={'dialog'}
                        onClick={() => setSheet('route')}
                    />

                    <WasHereButton
                        size={'large'}
                        hideLabel={true}
                        placeId={place?.id}
                        verificationExempt={place?.verificationExempt}
                    />

                    <Button
                        mode={bookmarked ? 'primary' : 'secondary'}
                        size={'large'}
                        icon={'Bookmark'}
                        tooltip={labels.save}
                        aria-haspopup={'dialog'}
                        onClick={() => requireAuth(() => setSheet('save'))}
                    />

                    <Button
                        mode={'secondary'}
                        size={'large'}
                        icon={'External'}
                        tooltip={labels.share}
                        aria-haspopup={nativeShare ? undefined : 'dialog'}
                        onClick={() => (nativeShare ? handleNativeShare() : setSheet('share'))}
                    />

                    <Button
                        mode={'secondary'}
                        size={'large'}
                        icon={'VerticalDots'}
                        tooltip={labels.menu}
                        aria-haspopup={'dialog'}
                        onClick={() => setSheet('menu')}
                    />
                </div>

                <BottomSheet
                    open={!!sheet}
                    title={
                        sheet === 'route'
                            ? labels.route
                            : sheet === 'save'
                              ? t('place-save-to', { defaultValue: 'Сохранить в' })
                              : sheet === 'share'
                                ? labels.share
                                : place?.title
                    }
                    onClose={() => setSheet(undefined)}
                >
                    {sheet === 'route' && routeItems}
                    {sheet === 'save' && saveItems}
                    {sheet === 'share' && shareItems}
                    {sheet === 'menu' && menuItems}
                </BottomSheet>

                {dialogs}
            </>
        )
    }

    return (
        <>
            <div className={styles.toolbar}>
                <Popout
                    closeOnChildrenClick={true}
                    trigger={
                        <Button
                            mode={'primary'}
                            size={'medium'}
                            icon={'Compass'}
                            label={labels.route}
                            aria-haspopup={'menu'}
                        />
                    }
                >
                    {routeItems}
                </Popout>

                <WasHereButton
                    size={'medium'}
                    placeId={place?.id}
                    verificationExempt={place?.verificationExempt}
                />

                <Popout
                    closeOnChildrenClick={true}
                    disabled={!isAuth}
                    trigger={
                        <Button
                            mode={bookmarked ? 'primary' : 'secondary'}
                            size={'medium'}
                            icon={'Bookmark'}
                            tooltip={labels.save}
                            aria-haspopup={'menu'}
                            onClick={() => requireAuth(() => undefined)}
                        />
                    }
                >
                    <div className={'contextListMenuLabel'}>{t('place-save-to', { defaultValue: 'Сохранить в' })}</div>
                    {saveItems}
                </Popout>

                {nativeShare ? (
                    <Button
                        mode={'secondary'}
                        size={'medium'}
                        icon={'External'}
                        tooltip={labels.share}
                        onClick={handleNativeShare}
                    />
                ) : (
                    <Popout
                        trigger={
                            <Button
                                mode={'secondary'}
                                size={'medium'}
                                icon={'External'}
                                tooltip={labels.share}
                                aria-haspopup={'menu'}
                            />
                        }
                    >
                        {shareItems}
                    </Popout>
                )}

                <Popout
                    closeOnChildrenClick={true}
                    trigger={
                        <Button
                            mode={'link'}
                            size={'medium'}
                            icon={'VerticalDots'}
                            tooltip={labels.menu}
                            aria-haspopup={'menu'}
                        />
                    }
                >
                    {menuItems}
                </Popout>
            </div>

            {dialogs}
        </>
    )
}
