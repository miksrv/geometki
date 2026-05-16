import React, { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { Button, Icon, Popout, Spinner } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel, ApiType } from '@/api'
import { openAuthDialog } from '@/app/applicationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { BookmarkButton } from '@/components/shared'
import { IMG_HOST } from '@/config/env'

import styles from './styles.module.sass'

const ConfirmationDialog = dynamic(() => import('@/components/shared/confirmation-dialog/ConfirmationDialog'), {
    ssr: false
})

interface PlaceHeaderProps {
    place?: ApiModel.Place
    coverHash?: number
    onPhotoUploadClick?: (event?: React.MouseEvent) => void
    onChangePlaceCoverClick?: (event?: React.MouseEvent) => void
}

type PlaceAddress = {
    id?: number
    name?: string
    type: ApiType.LocationTypes
}

export const PlaceHeader: React.FC<PlaceHeaderProps> = ({
    place,
    coverHash,
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

    const coverHashString = coverHash || dayjs(place?.updated?.date).unix()
    const placeAddress: PlaceAddress[] = useMemo(() => {
        const addressTypes: ApiType.LocationTypes[] = ['country', 'region', 'district', 'locality']
        const address: PlaceAddress[] = []

        addressTypes.forEach((type) => {
            if (place?.address?.[type]?.id) {
                address.push({
                    id: place?.address[type]?.id,
                    name: place?.address[type]?.name,
                    type
                })
            }
        })

        return address
    }, [place?.address])

    const handleEditPlaceClick = (event: React.MouseEvent) => {
        if (!isAuth) {
            event.preventDefault()
            dispatch(openAuthDialog())
        }
    }

    const handleRemovePlaceClick = (event: React.MouseEvent) => {
        event.preventDefault()
        setShowRemoveDialog(true)
    }

    const handleBackLinkClick = async () => {
        router.back()
    }

    useEffect(() => {
        if (removeSuccess) {
            void handleBackLinkClick()
        }
    }, [removeSuccess])

    return (
        <section className={styles.placeHeader}>
            {removeLoading && (
                <div className={styles.loader}>
                    <Spinner />
                </div>
            )}

            <div className={styles.image}>
                {place?.cover && (
                    <Image
                        src={`${IMG_HOST}${place.cover.full}?d=${coverHashString}`}
                        alt={place.title || ''}
                        fill={true}
                        priority={true}
                        style={{ objectFit: 'cover' }}
                        sizes={'(max-width: 768px) 100vw, 1024px'}
                    />
                )}
            </div>

            <div className={styles.topPanel}>
                <Button
                    className={styles.backLink}
                    onClick={handleBackLinkClick}
                    icon={'KeyboardLeft'}
                />

                <div className={styles.actionButtons}>
                    <BookmarkButton
                        size={'medium'}
                        mode={'secondary'}
                        placeId={place?.id}
                    />

                    <Popout
                        className={styles.contextMenu}
                        closeOnChildrenClick={true}
                        trigger={
                            <Button
                                icon={'VerticalDots'}
                                size={'medium'}
                                mode={'secondary'}
                            />
                        }
                    >
                        <ul className={'contextListMenu'}>
                            <li>
                                <Link
                                    href={`/map#${place?.lat},${place?.lon},14`}
                                    title={t('open-on-map')}
                                >
                                    {/* eslint-disable-next-line react/jsx-max-depth */}
                                    <Icon name={'Map'} />
                                    {t('open-on-map')}
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href={'#'}
                                    title={t('upload-photo')}
                                    onClick={(e) => {
                                        e.preventDefault()
                                        onPhotoUploadClick?.(e)
                                    }}
                                >
                                    {/* eslint-disable-next-line react/jsx-max-depth */}
                                    <Icon name={'Camera'} />
                                    {t('upload-photo')}
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href={'#'}
                                    title={t('change-cover')}
                                    onClick={(e) => {
                                        e.preventDefault()
                                        onChangePlaceCoverClick?.(e)
                                    }}
                                >
                                    {/* eslint-disable-next-line react/jsx-max-depth */}
                                    <Icon name={'Photo'} />
                                    {t('change-cover')}
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href={isAuth ? `/places/${place?.id}/edit` : '#'}
                                    onClick={handleEditPlaceClick}
                                    title={t('edit')}
                                >
                                    {/* eslint-disable-next-line react/jsx-max-depth */}
                                    <Icon name={'EditLocation'} />
                                    {t('edit')}
                                </Link>
                            </li>
                            {userRole === 'admin' && (
                                <li>
                                    <Link
                                        href={'#'}
                                        onClick={handleRemovePlaceClick}
                                        title={t('delete')}
                                    >
                                        <Icon name={'Close'} />
                                        {t('delete')}
                                    </Link>
                                </li>
                            )}
                        </ul>
                    </Popout>
                </div>
            </div>

            <div className={styles.bottomPanel}>
                <h1>{place?.title}</h1>
                <div className={styles.address}>
                    {placeAddress.map((address, i) => (
                        <span key={`address${address.type}`}>
                            <Link
                                href={`/places?${address.type}=${address.id}`}
                                title={`${t('all-geotags-at-address')} ${address.name}`}
                            >
                                {address.name}
                            </Link>
                            {placeAddress.length - 1 !== i && ', '}
                        </span>
                    ))}

                    {place?.address?.street && <>{`, ${place.address.street}`}</>}
                </div>
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
        </section>
    )
}
