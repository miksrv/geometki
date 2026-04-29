import React, { useCallback, useMemo } from 'react'
import debounce from 'lodash-es/debounce'
import { Input, Select, SelectOptionType } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { UserSortFields } from '@/api/types/users'

import { UsersFilterType } from './types'

import styles from './styles.module.sass'

interface UsersFilterPanelProps {
    search?: string
    sort?: string
    order?: string
    onChange?: (key: keyof UsersFilterType, value: string | undefined) => void
}

export const UsersFilterPanel: React.FC<UsersFilterPanelProps> = ({ search, sort, order, onChange }) => {
    const { t } = useTranslation()

    const sortOptions: Array<SelectOptionType<string>> = useMemo(
        () =>
            Object.values(UserSortFields).map((s) => ({
                key: s,
                value: t(`sort_${s}`)
            })),
        [t]
    )

    const orderOptions: Array<SelectOptionType<string>> = useMemo(
        () => [
            { key: 'ASC', value: t('order_ASC') },
            { key: 'DESC', value: t('order_DESC') }
        ],
        [t]
    )

    const handleChangeSort = (selected: Array<SelectOptionType<string>> | undefined) => {
        onChange?.('sort', selected?.[0]?.key)
    }

    const handleChangeOrder = (selected: Array<SelectOptionType<string>> | undefined) => {
        onChange?.('order', selected?.[0]?.key)
    }

    const handleChangeSearch = useCallback(
        debounce((value: string) => {
            onChange?.('search', value || undefined)
        }, 600),
        [onChange]
    )

    return (
        <div className={styles.component}>
            <Input
                clearable={true}
                placeholder={t('search-by-name')}
                defaultValue={search ?? ''}
                onChange={(e) => handleChangeSearch(e.target.value)}
                size={'medium'}
            />

            <Select
                placeholder={t('sorting')}
                options={sortOptions}
                value={sort}
                onSelect={handleChangeSort}
            />

            <Select
                placeholder={t('order')}
                options={orderOptions}
                value={order}
                onSelect={handleChangeOrder}
            />
        </div>
    )
}
