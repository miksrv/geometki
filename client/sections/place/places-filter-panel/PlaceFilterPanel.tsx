import React, { useCallback, useMemo } from 'react'
import debounce from 'lodash-es/debounce'
import { Select, SelectOptionType } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next'

import { API, ApiModel, ApiType } from '@/api'
import { useAppSelector } from '@/app/store'
import { categoryImage } from '@/utils/categories'

import { PlacesFilterType } from './types'

import styles from './styles.module.sass'

interface PlaceFilterPanelProps {
    sort?: ApiType.SortFieldsType
    order?: ApiType.SortOrdersType
    location?: ApiModel.AddressItem
    category?: string | null
    onChange?: (key: keyof PlacesFilterType, value: string | number | undefined) => void
    onChangeLocation?: (location?: ApiModel.AddressItem) => void
}

export const PlaceFilterPanel: React.FC<PlaceFilterPanelProps> = ({
    sort,
    order,
    location,
    category,
    onChange,
    onChangeLocation
}) => {
    const { t } = useTranslation()

    const userLocation = useAppSelector((state) => state.application.userLocation)
    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const { data: categoryData } = API.useCategoriesGetListQuery()

    const [searchAddress, { data: addressData, isLoading: addressLoading }] = API.useLocationGetSearchMutation()

    const sortOptions: Array<SelectOptionType<string>> = useMemo(
        () =>
            Object.values(ApiType.SortFields)
                .filter((s) => s !== ApiType.SortFields.Category)
                .filter((s) => !(s === ApiType.SortFields.Recommended && !isAuth))
                .filter((s) => !(s === ApiType.SortFields.Trending && isAuth))
                .map((s) => ({
                    disabled: s === ApiType.SortFields.Distance && (!userLocation?.lat || !userLocation.lon),
                    key: s,
                    value: t(`sort_${s}`)
                })),
        [isAuth, userLocation]
    )

    const orderOptions: Array<SelectOptionType<string>> = useMemo(
        () => Object.values(ApiType.SortOrders).map((o) => ({ key: o, value: t(`order_${o}`) })),
        []
    )

    const categoryOptions: Array<SelectOptionType<string>> = useMemo(
        () =>
            categoryData?.items?.map((item) => ({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                image: categoryImage(item.name as ApiModel.Categories) as any,
                key: item.name,
                value: item.title
            })) ?? [],
        [categoryData?.items]
    )

    const locationOptions: Array<SelectOptionType<string>> = useMemo(() => {
        const results: Array<SelectOptionType<string>> = [
            ...(addressData?.countries?.map((item) => ({ key: `country:${item.id}`, value: item.name })) ?? []),
            ...(addressData?.regions?.map((item) => ({ key: `region:${item.id}`, value: item.name })) ?? []),
            ...(addressData?.districts?.map((item) => ({ key: `district:${item.id}`, value: item.name })) ?? []),
            ...(addressData?.cities?.map((item) => ({ key: `locality:${item.id}`, value: item.name })) ?? [])
        ]

        if (location?.id && location?.name && location?.type) {
            const currentKey = `${location.type}:${location.id}`
            if (!results.find((o) => o.key === currentKey)) {
                results.unshift({ key: currentKey, value: location.name })
            }
        }

        return results
    }, [addressData, location])

    const handleChangeSort = (selected: Array<SelectOptionType<string>> | undefined) => {
        onChange?.('sort', selected?.[0]?.key)
    }

    const handleChangeOrder = (selected: Array<SelectOptionType<string>> | undefined) => {
        onChange?.('order', selected?.[0]?.key)
    }

    const handleChangeCategory = (selected: Array<SelectOptionType<string>> | undefined) => {
        onChange?.('category', selected?.[0]?.key)
    }

    const handleChangeLocation = (selected: Array<SelectOptionType<string>> | undefined) => {
        const item = selected?.[0]
        if (!item) {
            onChangeLocation?.(undefined)
            return
        }
        const colonIndex = item.key.indexOf(':')
        const type = item.key.slice(0, colonIndex) as ApiType.LocationTypes
        const id = parseInt(item.key.slice(colonIndex + 1), 10)
        onChangeLocation?.({ id, name: item.value, type })
    }

    const handleSearchLocation = useCallback(
        debounce(async (text?: string) => {
            if (text && text.length >= 3) {
                await searchAddress(text)
            }
        }, 600),
        []
    )

    return (
        <div className={styles.component}>
            <Select
                searchable={true}
                clearable={true}
                loading={addressLoading}
                placeholder={t('filter-by-location')}
                notFoundCaption={t('nothing-found')}
                options={locationOptions}
                value={location?.id && location?.type ? `${location.type}:${location.id}` : undefined}
                onSearch={handleSearchLocation}
                onSelect={handleChangeLocation}
            />

            <Select
                placeholder={t('sorting-geotags')}
                options={sortOptions}
                value={sort}
                onSelect={handleChangeSort}
            />

            {sort !== ApiType.SortFields.Recommended && (
                <Select
                    placeholder={t('sorting-order')}
                    options={orderOptions}
                    value={order}
                    onSelect={handleChangeOrder}
                />
            )}

            <Select
                clearable={true}
                placeholder={t('input_category-placeholder')}
                options={categoryOptions}
                value={category ?? undefined}
                onSelect={handleChangeCategory}
            />
        </div>
    )
}
