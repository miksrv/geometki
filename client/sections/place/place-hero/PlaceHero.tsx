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
import { AddToCollectionButton, BookmarkButton, CategoryIcon } from '@/components/shared'
import { Breadcrumbs } from '@/components/ui'
import { IMG_HOST } from '@/config/env'
import { buildLocationHref, buildPlacesHref, dateToUnixTime, getLandingFlags } from '@/utils/helpers'

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
    slug?: string | null
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
    const landingFlags = getLandingFlags()
    const placeAddress: PlaceAddress[] = useMemo(() => {
        const addressTypes: ApiType.LocationTypes[] = ['country', 'region', 'district', 'locality']
        const address: PlaceAddress[] = []

        addressTypes.forEach((type) => {
            if (place?.address?.[type]?.id) {
                address.push({
                    id: place?.address[type]?.id,
                    name: place?.address[type]?.name,
                    slug: place?.address[type]?.slug,
                    type
                })
            }
        })

        return address
    }, [place?.address])

    // The most specific level with an id — last in `placeAddress` (ordered country → locality)
    const mostSpecificAddress = [...placeAddress]
        .reverse()
        .find((item): item is PlaceAddress & { id: number } => !!item.id)

    const handleEditPlaceClick = (event: React.MouseEvent) => {
        if (!isAuth) {
            event.preventDefault()
            dispatch(openAuthDialog())
        }
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
                        // The hero spans the content column: full viewport below --width-max (1260px), 1228px above
                        sizes={'(max-width: 1260px) 100vw, 1228px'}
                    />
                )}
            </div>

            <div className={styles.topPanel}>
                <Breadcrumbs
                    className={styles.breadcrumbs}
                    links={[
                        { link: '/places', text: t('nav-places', { defaultValue: 'Места' }) },
                        ...(place?.category
                            ? [
                                  {
                                      // The most specific location of the place + the category
                                      // (features/20-location-seo-pages.md): with the relevant
                                      // flags off this reduces to the plain category link.
                                      link: buildPlacesHref(
                                          {
                                              category: place.category.name,
                                              defaultOrder: ApiType.SortOrders.DESC,
                                              defaultSort: ApiType.SortFields.Trending,
                                              location: mostSpecificAddress
                                                  ? {
                                                        id: mostSpecificAddress.id,
                                                        slug: mostSpecificAddress.slug,
                                                        type: mostSpecificAddress.type
                                                    }
                                                  : null
                                          },
                                          landingFlags
                                      ).href,
                                      text: place.category.title ?? ''
                                  }
                              ]
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
            </div>

            <div className={styles.bottomPanel}>
                <div className={styles.titleRow}>
                    {place?.category && (
                        <CategoryIcon
                            category={place.category}
                            size={40}
                            className={styles.category}
                        />
                    )}

                    <div className={styles.textContent}>
                        <h1>{place?.title}</h1>
                        <div className={styles.address}>
                            {placeAddress.map((address, i) => (
                                <span key={`address${address.type}`}>
                                    <Link
                                        href={
                                            address.id
                                                ? buildLocationHref(
                                                      { id: address.id, slug: address.slug, type: address.type },
                                                      landingFlags
                                                  )
                                                : '/places'
                                        }
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
