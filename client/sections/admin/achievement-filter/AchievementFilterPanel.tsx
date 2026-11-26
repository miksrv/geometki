import React, { useEffect, useMemo, useRef, useState } from 'react'
import debounce from 'lodash-es/debounce'
import { Input, Select, SelectOptionType } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { ListingToolbar, ListingToolbarGroup } from '@/components/shared'

import { AchievementFilter } from './filterAchievements'

const TYPES = ['base', 'seasonal']

interface AchievementFilterPanelProps {
    filter: AchievementFilter
    onChange: (key: keyof AchievementFilter, value: string | undefined) => void
}

/** The filter row of the admin achievements: a search over the titles and the type (the on / off views are above it) */
export const AchievementFilterPanel: React.FC<AchievementFilterPanelProps> = ({ filter, onChange }) => {
    const { t } = useTranslation()

    // The text is typed here and reaches the filter (the page's URL) a moment after the last key
    const [query, setQuery] = useState<string>(filter.query ?? '')
    // `onChange` changes with every change of the URL: the timer is made once and calls the last
    // one, else a key typed while the URL is being replaced would be dropped with the old timer
    const onChangeRef = useRef(onChange)

    useEffect(() => {
        onChangeRef.current = onChange
    }, [onChange])

    const applyQuery = useMemo(
        () => debounce((value: string) => onChangeRef.current('query', value || undefined), 250),
        []
    )

    useEffect(() => () => applyQuery.cancel(), [applyQuery])

    // The filter was cleared from outside (the empty list's "reset"): the field follows
    useEffect(() => {
        if (!filter.query) {
            setQuery('')
        }
    }, [filter.query])

    const types: Array<SelectOptionType<string>> = [
        { key: '', value: t('achievements-admin-filter-type-all') },
        ...TYPES.map((key) => ({ key, value: t(`achievements-${key}`) }))
    ]

    return (
        <ListingToolbar>
            <ListingToolbarGroup>
                <Input
                    clearable={true}
                    placeholder={t('achievements-admin-filter-search')}
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value)
                        applyQuery(event.target.value)
                    }}
                    size={'medium'}
                />
                <Select
                    clearable={true}
                    placeholder={t('achievements-admin-type')}
                    options={types}
                    value={filter.type ?? ''}
                    onSelect={(selected) => onChange('type', selected?.[0]?.key || undefined)}
                />
            </ListingToolbarGroup>
        </ListingToolbar>
    )
}
