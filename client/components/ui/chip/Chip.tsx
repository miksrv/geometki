import React from 'react'
import { cn, Icon } from 'simple-react-ui-kit'

import Link from 'next/link'

import styles from './styles.module.sass'

export interface ChipProps {
    label: string
    /** A 20px picture before the label: a category icon, a kit `Icon` */
    icon?: React.ReactNode
    /** A quiet number after the label: how many there are (the facets of a search) */
    count?: number
    /** On: filled with `--color-main` (a toggle chip) */
    selected?: boolean
    /** The third state of a three-state toggle (yes / no / not answered): a "no" — the label struck through on a muted tint. Not told apart from "not answered" by `aria-pressed` (`false` for both): pass an `aria-label` that names the state */
    negative?: boolean
    /** A removal chip: tinted, with a ✕ after the label (the applied filters row) */
    removable?: boolean
    /** Makes the chip a link: filters that are pages stay crawlable and open in a new tab */
    href?: string
    /** The link's `rel`: `nofollow` for a link to a filter combination that is no page of its own */
    rel?: string
    /** The link changes only the URL's query of this page: no `getServerSideProps`, the scroll stays */
    shallow?: boolean
    /** `medium` — 36px (the category rail), `small` — 28px (the applied filters) */
    size?: 'medium' | 'small'
    /** The accessible name when the label alone is not enough ("Убрать фильтр: Пещеры") */
    'aria-label'?: string
    className?: string
    onClick?: (event: React.MouseEvent) => void
}

/**
 * A pill with an optional icon: a toggle of a filter (`selected`) or a removable applied
 * filter (`removable`); `negative` is the "no" of a three-state toggle. A link with `href`, a button otherwise; a toggle button reports its
 * state with `aria-pressed`. A kit primitive candidate.
 */
export const Chip: React.FC<ChipProps> = ({
    label,
    icon,
    count,
    selected,
    negative,
    removable,
    href,
    rel,
    shallow,
    size = 'medium',
    'aria-label': ariaLabel,
    className,
    onClick
}) => {
    const classNames = cn(
        styles.chip,
        size === 'small' && styles.small,
        selected && styles.selected,
        negative && !selected && styles.negative,
        removable && styles.removable,
        !icon && styles.noIcon,
        className
    )

    const content = (
        <>
            {icon && (
                <span
                    className={styles.icon}
                    aria-hidden={true}
                >
                    {icon}
                </span>
            )}
            <span className={styles.label}>{label}</span>
            {count !== undefined && <span className={styles.count}>{count}</span>}
            {removable && (
                <Icon
                    name={'Close'}
                    className={styles.remove}
                />
            )}
        </>
    )

    if (href) {
        return (
            <Link
                href={href}
                rel={rel}
                shallow={shallow}
                scroll={shallow ? false : undefined}
                className={classNames}
                aria-label={ariaLabel}
                aria-current={selected ? 'true' : undefined}
                onClick={onClick}
            >
                {content}
            </Link>
        )
    }

    return (
        <button
            type={'button'}
            className={classNames}
            aria-label={ariaLabel}
            aria-pressed={removable ? undefined : !!selected}
            onClick={onClick}
        >
            {content}
        </button>
    )
}
