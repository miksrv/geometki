import React, { useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import { cn, Icon, Spinner } from 'simple-react-ui-kit'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import useSiteSearch, { SiteSearchItem } from '@/hooks/useSiteSearch'
import { categoryImage } from '@/utils/categories'
import { splitByMatch } from '@/utils/highlight'

import { SiteSearchScreen } from './SiteSearchScreen'

import styles from './styles.module.sass'

export interface SiteSearchHandle {
    focus: () => void
}

interface SiteSearchProps {
    /**
     * `bar` — the compact field of the app bar; `hero` — the big field of the home page;
     * `screen` — the full-screen search of phones (always open, a back button)
     */
    variant?: 'bar' | 'hero' | 'screen'
    placeholder?: string
    autoFocus?: boolean
    /** Up to this screen width (px, the phones' `$mobileMaxWidth`) the field opens the full-screen search */
    screenMaxWidth?: number
    /** `screen`: the back button and Escape */
    onClose?: () => void
    className?: string
}

const isModifiedClick = (event: React.MouseEvent) =>
    event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button === 1

const Highlighted: React.FC<{ text: string; query: string }> = ({ text, query }) => (
    <>
        {splitByMatch(text, query).map((part, index) =>
            part.match ? <mark key={index}>{part.text}</mark> : <React.Fragment key={index}>{part.text}</React.Fragment>
        )}
    </>
)

/**
 * The site search (DESIGN.md → Patterns → Site search): a combobox whose panel answers before
 * anything is typed ("Места рядом", the recent searches, the fullest regions) and while typing
 * (the query itself, a point, places, regions and cities, addresses), the words of the query
 * marked. Arrows move over the rows, Enter opens the row or the search page, Escape closes;
 * rows are links, so they open in a new tab too.
 */
export const SiteSearch = React.forwardRef<SiteSearchHandle, SiteSearchProps>(
    ({ variant = 'bar', placeholder, autoFocus, screenMaxWidth, onClose, className }, ref) => {
        const { t } = useTranslation()

        const isScreen = variant === 'screen'
        const [focused, setFocused] = useState<boolean>(false)
        const [dismissed, setDismissed] = useState<boolean>(false)
        const [active, setActive] = useState<number>(-1)
        const [screenOpen, setScreenOpen] = useState<boolean>(false)

        const open = isScreen || (focused && !dismissed)
        const search = useSiteSearch(open)
        const { items, sections, hint, loading, query } = search

        const inputRef = useRef<HTMLInputElement>(null)
        const listId = useId()
        const optionId = (index: number) => `${listId}-${index}`

        useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), [])

        // A new list: nothing is chosen until the arrows say so
        useEffect(() => setActive(-1), [items])

        useEffect(() => {
            if (active >= 0) {
                document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' })
            }
        }, [active])

        const close = () => {
            if (isScreen) {
                onClose?.()
            } else {
                setDismissed(true)
                inputRef.current?.blur()
            }
        }

        const choose = (item: SiteSearchItem) => {
            close()
            void search.select(item)
        }

        const handleFocus = () => {
            // Phones: the field of the page opens the full-screen search, a keyboard and a list fit there
            if (screenMaxWidth && window.matchMedia(`(max-width: ${screenMaxWidth}px)`).matches) {
                inputRef.current?.blur()
                setScreenOpen(true)
                return
            }

            setFocused(true)
            setDismissed(false)
        }

        const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
            if (event.nativeEvent.isComposing) {
                return
            }

            switch (event.key) {
                case 'ArrowDown':
                case 'ArrowUp': {
                    event.preventDefault()
                    setDismissed(false)

                    // The rows go round through the field itself (-1): past the last row is the text
                    if (items.length) {
                        setActive((current) =>
                            event.key === 'ArrowDown'
                                ? current + 1 < items.length
                                    ? current + 1
                                    : -1
                                : current - 1 >= -1
                                  ? current - 1
                                  : items.length - 1
                        )
                    }
                    break
                }

                case 'Enter': {
                    event.preventDefault()

                    if (open && items[active]) {
                        choose(items[active])
                    } else if (query.trim()) {
                        close()
                        void search.submit()
                    }
                    break
                }

                case 'Escape': {
                    event.preventDefault()

                    if (!isScreen && query && !open) {
                        search.setQuery('')
                    } else {
                        close()
                    }
                    break
                }
            }
        }

        const handleRowClick = (event: React.MouseEvent, item: SiteSearchItem) => {
            // A new tab: the search stays as it is, the row is still remembered
            if (item.href && isModifiedClick(event)) {
                void search.select(item, { follow: false })
                return
            }

            event.preventDefault()
            choose(item)
        }

        const renderRow = (item: SiteSearchItem) => {
            const index = items.indexOf(item)
            const props = {
                'aria-selected': index === active,
                className: cn(styles.option, index === active && styles.optionActive),
                id: optionId(index),
                onClick: (event: React.MouseEvent) => handleRowClick(event, item),
                onMouseMove: () => index !== active && setActive(index),
                role: 'option',
                tabIndex: -1
            }

            const content = (
                <>
                    <span
                        className={cn(styles.tile, item.accent && styles.tileAccent)}
                        aria-hidden={true}
                    >
                        {'name' in item.icon ? (
                            <Icon name={item.icon.name} />
                        ) : (
                            <Image
                                src={categoryImage(item.icon.category ?? undefined)}
                                alt={''}
                                width={20}
                                height={20}
                            />
                        )}
                    </span>
                    <span className={styles.text}>
                        <span className={styles.label}>
                            {item.highlight ? (
                                <Highlighted
                                    text={item.label}
                                    query={query}
                                />
                            ) : (
                                item.label
                            )}
                        </span>
                        {item.caption && <span className={styles.caption}>{item.caption}</span>}
                    </span>
                    {item.key === 'all' && !isScreen && (
                        <kbd
                            className={styles.enterKey}
                            aria-hidden={true}
                        >
                            Enter
                        </kbd>
                    )}
                </>
            )

            return item.href ? (
                <Link
                    key={item.key}
                    href={item.href}
                    {...props}
                >
                    {content}
                </Link>
            ) : (
                <div
                    key={item.key}
                    {...props}
                >
                    {content}
                </div>
            )
        }

        const hasPanel = open && (sections.length > 0 || !!hint)

        return (
            <div
                className={cn(styles.siteSearch, styles[variant], hasPanel && styles.expanded, className)}
                role={'search'}
                onBlur={(event) => {
                    // Focus left the field and its panel (Tab, a click elsewhere)
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        setFocused(false)
                    }
                }}
            >
                <div className={styles.field}>
                    {isScreen ? (
                        <button
                            type={'button'}
                            className={styles.fieldButton}
                            aria-label={t('close-search', 'Закрыть поиск')}
                            onClick={onClose}
                        >
                            <Icon name={'KeyboardLeft'} />
                        </button>
                    ) : (
                        <Icon
                            name={'Search'}
                            className={styles.fieldIcon}
                        />
                    )}

                    <input
                        ref={inputRef}
                        className={styles.input}
                        type={'search'}
                        role={'combobox'}
                        enterKeyHint={'search'}
                        autoComplete={'off'}
                        autoCorrect={'off'}
                        spellCheck={false}
                        autoFocus={autoFocus}
                        placeholder={placeholder ?? t('global-search-placeholder', 'Места, города, координаты')}
                        aria-label={placeholder ?? t('global-search-placeholder', 'Места, города, координаты')}
                        aria-autocomplete={'list'}
                        aria-expanded={hasPanel}
                        aria-controls={listId}
                        aria-activedescendant={active >= 0 ? optionId(active) : undefined}
                        value={query}
                        onFocus={handleFocus}
                        onChange={(event) => {
                            setDismissed(false)
                            search.setQuery(event.target.value)
                        }}
                        onKeyDown={handleKeyDown}
                    />

                    {loading && <Spinner className={styles.spinner} />}

                    {query ? (
                        <button
                            type={'button'}
                            className={styles.fieldButton}
                            aria-label={t('search-clear', 'Очистить поле')}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                                search.setQuery('')
                                setDismissed(false)
                                inputRef.current?.focus()
                            }}
                        >
                            <Icon name={'Close'} />
                        </button>
                    ) : (
                        variant === 'bar' &&
                        !focused && (
                            <kbd
                                className={styles.shortcut}
                                title={t('search-shortcut', 'Нажмите «/», чтобы искать')}
                                aria-hidden={true}
                            >
                                /
                            </kbd>
                        )
                    )}
                </div>

                {hasPanel && (
                    <div
                        className={styles.panel}
                        // Clicks inside keep the focus in the field: the panel stays open under the pointer
                        onMouseDown={(event) => !isScreen && event.preventDefault()}
                    >
                        {hint && <div className={styles.hint}>{hint}</div>}

                        <div
                            id={listId}
                            role={'listbox'}
                            aria-label={t('search-suggestions', 'Подсказки поиска')}
                            className={styles.list}
                        >
                            {sections.map((section) => (
                                <div
                                    key={section.key}
                                    role={'group'}
                                    aria-labelledby={section.label ? `${listId}-${section.key}` : undefined}
                                    className={styles.group}
                                >
                                    {section.label && (
                                        <div className={styles.groupHead}>
                                            <span
                                                id={`${listId}-${section.key}`}
                                                className={styles.groupLabel}
                                            >
                                                {section.label}
                                            </span>
                                            {section.onClear && (
                                                <button
                                                    type={'button'}
                                                    className={styles.groupAction}
                                                    tabIndex={-1}
                                                    onClick={section.onClear}
                                                >
                                                    {t('clear', 'Очистить')}
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {section.items.map(renderRow)}
                                </div>
                            ))}
                        </div>

                        {!isScreen && (
                            <div
                                className={styles.footer}
                                aria-hidden={true}
                            >
                                <span>
                                    <kbd>↑</kbd>
                                    <kbd>↓</kbd>
                                    {t('search-keys-move', 'выбрать')}
                                </span>
                                <span>
                                    <kbd>Enter</kbd>
                                    {t('search-keys-open', 'открыть')}
                                </span>
                                <span>
                                    <kbd>Esc</kbd>
                                    {t('search-keys-close', 'закрыть')}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {!!screenMaxWidth && (
                    <SiteSearchScreen
                        open={screenOpen}
                        placeholder={placeholder}
                        onClose={() => setScreenOpen(false)}
                    />
                )}
            </div>
        )
    }
)

SiteSearch.displayName = 'SiteSearch'
