import React, { useEffect, useMemo, useState } from 'react'
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
    const applyQuery = useMemo(
        () => debounce((value: string) => onChange('query', value || undefined), 250),
        [onChange]
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
