import React from 'react'

import { OptionList } from '@/components/ui'

import { FilterPopout } from './FilterPanel'

export interface SortPopoutPreset<T extends string = string> {
    key: T
    label: string
    /** A second line under the label: what the order means ("Что смотрят на этой неделе") */
    caption?: string
}

interface SortPopoutProps<T extends string = string> {
    presets: Array<SortPopoutPreset<T>>
    /** The sort applied: its label is the field's value, its row is checked */
    value: T
    /** The field's value when the sort is none of the presets (one only an old URL can set) */
    valueLabel?: string
    /** The field's width in the row, px */
    width?: number
    className?: string
    /** A pick; the dropdown is closed first */
    onSelect: (key: T) => void
}

/**
 * The sort field of a filter row (DESIGN.md → Patterns → Filter panel): a `FilterPopout` with
 * the sort icon and the presets in an `OptionList`, each with its natural direction — no order
 * control. The places listing, the search and the people page.
 */
export const SortPopout = <T extends string = string>({
    presets,
    value,
    valueLabel,
    width = 240,
    className,
    onSelect
}: SortPopoutProps<T>) => (
    <FilterPopout
        width={width}
        icon={'BarChart'}
        className={className}
        value={presets.find(({ key }) => key === value)?.label ?? valueLabel ?? ''}
    >
        {(close) => (
            <OptionList<T>
                groups={[{ items: presets.map((preset) => ({ ...preset, selected: preset.key === value })) }]}
                onSelect={(key) => {
                    close()
                    onSelect(key)
                }}
            />
        )}
    </FilterPopout>
)
