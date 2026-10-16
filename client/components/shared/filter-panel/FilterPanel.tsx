import React, { useRef } from 'react'
import { cn, Icon, IconTypes, Popout, PopoutHandleProps } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { Counter, FieldTrigger } from '@/components/ui'

import styles from './styles.module.sass'

interface FilterPanelProps {
    /** Sticks under the app bar: `always`, only on `phones` (a page whose list scrolls in a column) */
    sticky?: 'always' | 'phones'
    className?: string
    children?: React.ReactNode
}

/**
 * The filter block above a list (DESIGN.md → Patterns → Filter panel): the desktop
 * `FilterToolbar`, the `FilterPhoneBar`, then the rails and the applied filters, on a
 * translucent blurred page background.
 */
export const FilterPanel: React.FC<FilterPanelProps> = ({ sticky, className, children }) => (
    <div
        className={cn(
            styles.panel,
            sticky === 'always' && styles.sticky,
            sticky === 'phones' && styles.stickyPhones,
            className
        )}
    >
        {children}
    </div>
)

/** The desktop row of fields; hidden on phones. `FilterToolbarSpacer` pushes the rest right */
export const FilterToolbar: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    const { t } = useTranslation()

    return (
        <div
            className={styles.toolbar}
            role={'toolbar'}
            aria-label={t('filters', 'Фильтры')}
        >
            {children}
        </div>
    )
}

export const FilterToolbarSpacer: React.FC = () => <span className={styles.spacer} />

/** The phone row in place of the toolbar */
export const FilterPhoneBar: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
    <div className={styles.phoneBar}>{children}</div>
)

interface FilterPopoutProps {
    icon?: IconTypes
    /** A quiet name before the value ("Где") */
    label?: string
    value: string
    active?: boolean
    /** The field's width in the row, px */
    width: number
    /** The dropdown's content; `close` before acting on a pick */
    children: (close: () => void) => React.ReactNode
}

/** A field of the toolbar: a `FieldTrigger` that opens a dropdown */
export const FilterPopout: React.FC<FilterPopoutProps> = ({ icon, label, value, active, width, children }) => {
    const popout = useRef<PopoutHandleProps>(null)

    return (
        <Popout
            ref={popout}
            className={styles.popout}
            style={{ width }}
            position={'left'}
            portal={true}
            trigger={
                <FieldTrigger
                    icon={icon}
                    label={label}
                    value={value}
                    active={active}
                />
            }
        >
            <div className={styles.dropdown}>{children(() => popout.current?.close())}</div>
        </Popout>
    )
}

interface FiltersButtonProps {
    /** Filters set: the badge */
    count: number
    onClick: () => void
}

/** The round phone button that opens the filters sheet, with the number of filters set */
export const FiltersButton: React.FC<FiltersButtonProps> = ({ count, onClick }) => {
    const { t } = useTranslation()

    return (
        <button
            type={'button'}
            className={styles.filtersButton}
            aria-label={
                count ? t('filters-with-count', 'Фильтры, выбрано: {{count}}', { count }) : t('filters', 'Фильтры')
            }
            onClick={onClick}
        >
            <Icon name={'Tune'} />
            <Counter
                className={styles.filtersBadge}
                value={count}
                color={'main'}
                aria-hidden={true}
            />
        </button>
    )
}
