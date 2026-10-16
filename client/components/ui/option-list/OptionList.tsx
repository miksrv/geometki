import React from 'react'
import { cn, Icon } from 'simple-react-ui-kit'

import styles from './styles.module.sass'

export interface OptionListItem<T extends string = string> {
    key: T
    label: string
    /** A second line under the label */
    caption?: string
    /** A 32px tile before the text: a kit `Icon`, a category icon */
    icon?: React.ReactNode
    /** The tile in `--color-main` on `--color-main-background` — the suggested option */
    accent?: boolean
    selected?: boolean
}

export interface OptionListGroup<T extends string = string> {
    /** An overline above the group ("Недавние") */
    label?: string
    items: Array<OptionListItem<T>>
}

export interface OptionListProps<T extends string = string> {
    groups: Array<OptionListGroup<T>>
    /** One line in place of the rows when no group has any */
    emptyText?: string
    className?: string
    onSelect?: (key: T) => void
}

/**
 * Rows to pick one value from, inside a dropdown or a sheet: an optional icon tile, the
 * label with a caption, a check on the chosen row; groups under overline labels. Each row is
 * a button that reports the choice with `aria-pressed`. A kit primitive candidate.
 */
export const OptionList = <T extends string = string>({
    groups,
    emptyText,
    className,
    onSelect
}: OptionListProps<T>) => {
    const visibleGroups = groups.filter(({ items }) => items.length)

    if (!visibleGroups.length) {
        return emptyText ? <div className={cn(styles.empty, className)}>{emptyText}</div> : null
    }

    return (
        <div className={cn(styles.optionList, className)}>
            {visibleGroups.map((group, index) => (
                <div
                    key={group.label ?? index}
                    role={'group'}
                    aria-label={group.label}
                >
                    {group.label && (
                        <div
                            className={styles.groupLabel}
                            aria-hidden={true}
                        >
                            {group.label}
                        </div>
                    )}

                    {group.items.map((item) => (
                        <button
                            key={item.key}
                            type={'button'}
                            className={cn(styles.option, item.selected && styles.selected)}
                            aria-pressed={!!item.selected}
                            onClick={() => onSelect?.(item.key)}
                        >
                            {item.icon && (
                                <span
                                    className={cn(styles.icon, item.accent && styles.accent)}
                                    aria-hidden={true}
                                >
                                    {item.icon}
                                </span>
                            )}
                            <span className={styles.text}>
                                {item.label}
                                {item.caption && <span className={styles.caption}>{item.caption}</span>}
                            </span>
                            <Icon
                                name={'CheckCircle'}
                                className={styles.check}
                            />
                        </button>
                    ))}
                </div>
            ))}
        </div>
    )
}
