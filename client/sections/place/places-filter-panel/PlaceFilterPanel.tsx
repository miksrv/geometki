import React, { useEffect, useMemo, useState } from 'react'

import { useTranslation } from 'next-i18next'

import { API, ApiModel, ApiType, useAppSelector } from '@/api'
import { Autocomplete, Dropdown, DropdownOption, DropdownOptionsList } from '@/components/ui'
import { categoryImage } from '@/functions/categories'

import { PlacesFilterType } from './types'

import styles from './styles.module.sass'

interface PlaceFilterPanelProps {
    sort?: ApiType.SortFieldsType
    order?: ApiType.SortOrdersType
    location?: ApiModel.AddressItem
    category?: string | null
    optionsOpen?: boolean
    onChange?: (key: keyof PlacesFilterType, value: string | number | undefined) => void
    onOpenOptions?: (title?: string) => void
    onChangeLocation?: (location?: ApiModel.AddressItem) => void
}

type OpenedOptionsType = 'sort' | 'order' | 'category' | undefined

export const PlaceFilterPanel: React.FC<PlaceFilterPanelProps> = ({
    sort,
    order,
    location,
    category,
    optionsOpen,
    onChange,
    onOpenOptions,
    onChangeLocation
}) => {
    const { t } = useTranslation()

    const userLocation = useAppSelector((state) => state.application.userLocation)

    const { data: categoryData } = API.useCategoriesGetListQuery()

    const [searchAddress, { data: addressData, isLoading: addressLoading }] = API.useLocationGetSearchMutation()

    const [openedOptions, setOpenedOptions] = useState<OpenedOptionsType>(undefined)

    const sortOptions: DropdownOption[] = useMemo(
        () =>
            Object.values(ApiType.SortFields)
                .filter((sort) => sort !== ApiType.SortFields.Category)
                .map((sort) => ({
                    disabled: sort === ApiType.SortFields.Distance && (!userLocation?.lat || !userLocation.lon),
                    key: sort,
                    value: t(`sort_${sort}`)
                })),
        [ApiType.SortFields]
    )

    const orderOptions: DropdownOption[] = useMemo(
        () =>
            Object.values(ApiType.SortOrders).map((order) => ({
                key: order,
                value: t(`order_${order}`)
            })),
        [ApiType.SortOrders]
    )

    const handleChangeSort = (value: DropdownOption | undefined) => {
        onChange?.('sort', value?.key)
        setOpenedOptions(undefined)
    }

    const handleChangeOrder = (value: DropdownOption | undefined) => {
        onChange?.('order', value?.key)
        setOpenedOptions(undefined)
    }

    const handleChangeCategory = (value: DropdownOption | undefined) => {
        onChange?.('category', value?.key)
        setOpenedOptions(undefined)
    }

    const handleOpenSort = () => {
        onOpenOptions?.(t('sorting'))
        setOpenedOptions('sort')
    }

    const handleOpenOrder = () => {
        onOpenOptions?.(t('order'))
        setOpenedOptions('order')
    }

    const handleOpenOptionsCategory = () => {
        onOpenOptions?.(t('category'))
        setOpenedOptions('category')
    }

    const handleSearchLocation = async (value: string) => {
        if (value.length >= 3) {
            await searchAddress(value)
        }
    }

    const categoryOptions = useMemo(
        () =>
            categoryData?.items?.map((item) => ({
                image: categoryImage(item.name),
                key: item.name,
                value: item.title
            })),
        [categoryData?.items]
    )

    const locationOptions = useMemo(
        () => [
            ...(addressData?.countries?.map((item) => ({
                title: item.name,
                type: 'country',
                value: item.id
            })) || []),
            ...(addressData?.regions?.map((item) => ({
                title: item.name,
                type: 'region',
                value: item.id
            })) || []),
            ...(addressData?.districts?.map((item) => ({
                title: item.name,
                type: 'district',
                value: item.id
            })) || []),
            ...(addressData?.cities?.map((item) => ({
                title: item.name,
                type: 'locality',
                value: item.id
            })) || [])
        ],
        [addressData]
    )

    const selectedSort = sortOptions.find(({ key }) => key === sort)
    const selectedOrder = orderOptions.find(({ key }) => key === order)
    const selectedCategory = categoryOptions?.find(({ key }) => key === category)

    useEffect(() => {
        if (!optionsOpen) {
            setOpenedOptions(undefined)
        }
    }, [optionsOpen])

    return (
        <div className={styles.component}>
            {openedOptions === 'sort' && (
                <DropdownOptionsList
                    selectedOption={selectedSort}
                    options={sortOptions}
                    onSelect={handleChangeSort}
                />
            )}

            {openedOptions === 'order' && (
                <DropdownOptionsList
                    selectedOption={selectedOrder}
                    options={orderOptions}
                    onSelect={handleChangeOrder}
                />
            )}

            {openedOptions === 'category' && (
                <DropdownOptionsList
                    selectedOption={selectedCategory}
                    options={categoryOptions}
                    onSelect={handleChangeCategory}
                />
            )}

            {!openedOptions && (
                <>
                    <Autocomplete
                        label={t('filter-by-location')}
                        notFoundCaption={t('nothing-found')}
                        placeholder={t('start-typing-caption')}
                        clearable={true}
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-ignore
                        value={
                            location?.id && location?.name
                                ? { value: location?.id, title: location?.name, type: location?.type }
                                : undefined
                        }
                        loading={addressLoading}
                        options={locationOptions}
                        onSearch={handleSearchLocation}
                        onSelect={(option) =>
                            onChangeLocation?.(
                                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                // @ts-ignore
                                option?.value
                                    ? {
                                          id: option?.value,
                                          name: option?.title,
                                          type: option?.type
                                      }
                                    : undefined
                            )
                        }
                    />

                    <Dropdown
                        label={t('sorting-geotags')}
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-ignore
                        value={selectedSort}
                        onSelect={handleChangeSort}
                        onOpen={handleOpenSort}
                    />

                    <Dropdown
                        label={t('sorting-order')}
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-ignore
                        value={selectedOrder}
                        onSelect={handleChangeOrder}
                        onOpen={handleOpenOrder}
                    />

                    <Dropdown
                        clearable={true}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        value={selectedCategory as any}
                        label={t('filter-by-category')}
                        placeholder={t('input_category-placeholder')}
                        onSelect={handleChangeCategory}
                        onOpen={handleOpenOptionsCategory}
                    />
                </>
            )}
        </div>
    )
}
