import React, { useEffect, useMemo, useRef } from 'react'
import debounce from 'lodash-es/debounce'
import { Input } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { UserSortFields } from '@/api/types/users'
import { FilterPanel } from '@/components/shared'
import { Tabs } from '@/components/ui'
import { encodeQueryData } from '@/utils/helpers'

import { USERS_DEFAULT_SORT, UsersFilterType } from './types'

import styles from './styles.module.sass'

/** The presets, each with its natural direction (the most first, the newest first) */
const SORT_TABS: Array<{ key: UserSortFields; label: string }> = [
    { key: UserSortFields.Activity, label: 'users-sort-activity' },
    { key: UserSortFields.Experience, label: 'users-sort-experience' },
    { key: UserSortFields.Reputation, label: 'users-sort-reputation' },
    { key: UserSortFields.Created, label: 'users-sort-created' }
]

interface UsersFilterPanelProps {
    search?: string
    sort?: string
    onChangeSearch?: (value: string | undefined) => void
}

/**
 * The filters of the people list (DESIGN.md → Patterns → People filters): the name search
 * and the sort presets as tab links. A sort link drops `?order=` and the page, so an old link
 * keeps its order only until the sort changes.
 */
export const UsersFilterPanel: React.FC<UsersFilterPanelProps> = ({ search, sort, onChangeSearch }) => {
    const { t } = useTranslation()

    const tabs = useMemo(
        () =>
            SORT_TABS.map(({ key, label }) => ({
                href:
                    '/users' +
                    encodeQueryData({
                        search: search || undefined,
                        sort: key !== USERS_DEFAULT_SORT ? key : undefined
                    } satisfies UsersFilterType),
                key,
                label: t(label)
            })),
        [search, t]
    )

    // The latest callback in a ref: the debounce is made once, so a re-render of the page
    // while the visitor types never drops the pending search
    const onChangeSearchRef = useRef(onChangeSearch)
    onChangeSearchRef.current = onChangeSearch

    const handleChangeSearch = useMemo(
        () => debounce((value: string) => onChangeSearchRef.current?.(value.trim() || undefined), 600),
        []
    )

    useEffect(() => () => handleChangeSearch.cancel(), [handleChangeSearch])

    return (
        <FilterPanel
            sticky={'always'}
            className={styles.panel}
        >
            <div
                className={styles.row}
                role={'search'}
            >
                <Input
                    // A new search from the URL (Back / Forward) puts its text into the field
                    key={search ?? ''}
                    className={styles.search}
                    clearable={true}
                    placeholder={t('search-by-name')}
                    aria-label={t('search-by-name')}
                    defaultValue={search ?? ''}
                    onChange={(e) => handleChangeSearch(e.target.value)}
                    size={'medium'}
                />

                <Tabs<UserSortFields>
                    className={styles.tabs}
                    tabs={tabs}
                    activeTab={(sort as UserSortFields) ?? USERS_DEFAULT_SORT}
                    aria-label={t('users-sort', 'Порядок')}
                />
            </div>
        </FilterPanel>
    )
}
