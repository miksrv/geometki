import React, { useMemo, useState } from 'react'

import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next'

import { API, ApiType } from '@/api'
import { Autocomplete, AutocompleteOption } from '@/components/ui'
import { categoryImage } from '@/utils/categories'
import * as Coordinates from '@/utils/coordinates'

import styles from './styles.module.sass'

enum AutocompleteOptionType {
    COORDINATES = 'coordinates',
    POINT = 'point'
}

type SearchProps = React.InputHTMLAttributes<HTMLInputElement>

export const Search: React.FC<SearchProps> = () => {
    const { t } = useTranslation('components.app-bar.search')
    const router = useRouter()

    const [foundCoords, setFoundCoords] = useState<Array<AutocompleteOption<ApiType.Coordinates>>>()
    const [searchString, setSearchString] = useState<string>('')

    const [geoSearch, { data: locationAddress, isLoading: loadingAddress }] = API.useLocationGetGeoSearchMutation()

    const { data, isFetching } = API.usePlacesGetListQuery(
        {
            limit: 10,
            search: searchString
        },
        { skip: searchString.length <= 2 }
    )

    const options = useMemo(
        () =>
            data?.items?.map((item) => {
                const address: string[] = []

                if (item.address?.country) {
                    address.push(item.address.country.name)
                }

                if (item.address?.region) {
                    address.push(item.address.region.name)
                }

                if (item.address?.district) {
                    address.push(item.address.district.name)
                }

                if (item.address?.locality) {
                    address.push(item.address.locality.name)
                }

                return {
                    description: address.join(', '),
                    image: categoryImage(item.category?.name),
                    title: item.title,
                    type: AutocompleteOptionType.POINT,
                    value: item.id
                }
            }) || [],
        [data?.items]
    )

    const locationOptions = useMemo(
        () =>
            locationAddress?.items
                ?.filter((item) => !!item.lat && !!item.lon)
                .map((item) => {
                    const address: string[] = []

                    if (item.country) {
                        address.push(item.country)
                    }

                    if (item.region) {
                        address.push(item.region)
                    }

                    if (item.district) {
                        address.push(item.district)
                    }

                    if (item.locality) {
                        address.push(item.locality)
                    }

                    if (item.street) {
                        address.push(item.street)
                    }

                    return {
                        description: address.join(', '),
                        key: (item.lat || 0) + (item.lon || 0),
                        title: item.locality ?? item.region ?? item.district ?? item.country ?? '',
                        type: AutocompleteOptionType.COORDINATES,
                        value: {
                            lat: Number(item.lat),
                            lon: Number(item.lon)
                        }
                    }
                }) || [],
        [locationAddress?.items]
    )

    const handleSearchLocation = async (value: string) => {
        const normalizeCoords = Coordinates.normalizeInput(value)

        if (Coordinates.isCoordinates(value)) {
            for (const parser of [
                Coordinates.CoordinatesD,
                Coordinates.CoordinatesDM,
                Coordinates.CoordinatesDMS,
                Coordinates.CoordinatesDSigned
            ]) {
                const result = parser.fromString(normalizeCoords)

                if (!result.error) {
                    const resultItems = result.coordinates?.map((it: Coordinates.CoordinateDItem) => {
                        const coordStrings = it.format()
                        const latLng = it.getLatLng()

                        return {
                            description: t('coordinates', { defaultValue: 'Координаты' }),
                            key: coordStrings.latitude,
                            title: `${coordStrings.latitude as string} ${coordStrings.longitude as string}`,
                            type: AutocompleteOptionType.COORDINATES,
                            value: {
                                lat: latLng.lat,
                                lon: latLng.lon
                            }
                        }
                    })

                    setFoundCoords(resultItems)
                }
            }
        } else {
            setFoundCoords(undefined)
            setSearchString(value)
            await geoSearch(value)
        }
    }

    const handleSelectLocation = async (value?: AutocompleteOption<string | ApiType.Coordinates>) => {
        if (value?.type === AutocompleteOptionType.COORDINATES) {
            const coords = value?.value as ApiType.Coordinates
            const hash = `${coords.lat},${coords.lon},17?m=${coords.lat},${coords.lon}`

            if (router.pathname === '/map') {
                await router.replace({ hash, pathname: '/map' })
            } else {
                await router.push(`/map#${hash}`)
            }
        } else {
            await router.push(`/places/${value?.value as string}`)
        }
    }

    return (
        <Autocomplete<string | ApiType.Coordinates>
            className={styles.search}
            notFoundCaption={t('nothing-found', { defaultValue: 'Ничего не найдено' })}
            placeholder={t('global-search_placeholder', { defaultValue: 'Поиск по сайту' })}
            debounceDelay={200}
            leftIcon={'Search'}
            hideArrow={!options?.length || !searchString.length}
            loading={isFetching || loadingAddress}
            options={foundCoords ?? [...(options || []), ...(locationOptions || [])]}
            onSearch={handleSearchLocation}
            onSelect={handleSelectLocation}
        />
    )
}
