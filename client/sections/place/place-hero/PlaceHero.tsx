import React, { useEffect, useMemo, useState } from 'react'
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
import { Breadcrumbs } from '@/components/ui'
import { IMG_HOST } from '@/config/env'
import { AddToCollectionButton } from '@/sections/collections'
import { dateToUnixTime } from '@/utils/helpers'

import styles from './styles.module.sass'

const ConfirmationDialog = dynamic(() => import('@/components/shared/confirmation-dialog/ConfirmationDialog'), {
    ssr: false
})

interface PlaceHeroProps {
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

export const PlaceHero: React.FC<PlaceHeroProps> = ({
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

    const coverHashString = coverHash || dateToUnixTime(place?.updated?.date)
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

    useEffect(() => {
        if (removeSuccess) {
            void router.push('/places')
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
                <Breadcrumbs
                    className={styles.breadcrumbs}
                    links={[
                        { link: '/places', text: t('nav-places', { defaultValue: 'Места' }) },
                        ...(place?.category
                            ? [{ link: `/places?category=${place.category.name}`, text: place.category.title ?? '' }]
                            : [])
                    ]}
                />

                <div className={styles.actionButtons}>
                    <Popout
                        className={styles.contextMenu}
                        closeOnChildrenClick={true}
                        trigger={
                            <Button
                                icon={'VerticalDots'}
                                size={'medium'}
                                mode={'secondary'}
                                tooltip={t('place_menu', { defaultValue: 'Действия с местом' })}
                            />
                        }
                    >
                        <ul className={'contextListMenu'}>
                            <li>
                                <Link href={`/map#${place?.lat},${place?.lon},14`}>
                                    {/* eslint-disable-next-line react/jsx-max-depth */}
                                    <Icon name={'Map'} />
                                    {t('open-on-map')}
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href={'#'}
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
                <div className={styles.textContent}>
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

                <div className={styles.actions}>
                    <BookmarkButton
                        size={'medium'}
                        placeId={place?.id}
                    />
                    <AddToCollectionButton
                        size={'medium'}
                        placeId={place?.id}
                    />
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
