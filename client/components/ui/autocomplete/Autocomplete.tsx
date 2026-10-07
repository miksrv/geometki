import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import debounce from 'lodash-es/debounce'
import { cn, Icon, IconTypes, Spinner } from 'simple-react-ui-kit'

import Image, { StaticImageData } from 'next/image'
import { useTranslation } from 'next-i18next/pages'

import styles from './styles.module.sass'

export type AutocompleteOption<T> = {
    title: string
    value: T
    type?: string
    image?: StaticImageData
    description?: string
}

interface DropdownProps<T> {
    className?: string
    options?: Array<AutocompleteOption<T>>
    loading?: boolean
    disabled?: boolean
    clearable?: boolean
    hideArrow?: boolean
    debouncing?: boolean
    debounceDelay?: number
    notFoundCaption?: string
    placeholder?: string
    label?: string
    value?: T
    minLength?: number
    leftIcon?: IconTypes
    onSelect?: (option?: AutocompleteOption<T>) => void
    onSearch?: (value: string) => void
    onClear?: () => void
    onEnterPress?: (value: string) => void
    inputValue?: string
    suppressDropdown?: boolean
    autoFocus?: boolean
}

export const Autocomplete = <T,>({
    className,
    options,
    disabled,
    loading,
    clearable,
    hideArrow,
    debouncing = true,
    debounceDelay = 1000,
    value,
    minLength = 3,
    notFoundCaption,
    placeholder,
    label,
    leftIcon,
    onSelect,
    onSearch,
    onClear,
    onEnterPress,
    inputValue: externalInputValue,
    suppressDropdown,
    autoFocus
}: DropdownProps<T>) => {
    const { t } = useTranslation()
    const dropdownRef = useRef<HTMLDivElement>(null)
    const listboxId = useId()
    const [search, setSearch] = useState<string>()
    const [localLoading, setLocalLoading] = useState<boolean>(false)
    const [isOpen, setIsOpen] = useState<boolean>(false)
    const [selectedOption, setSelectedOption] = useState<AutocompleteOption<T> | undefined>(undefined)
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)

    const getOptionId = (index: number) => `${listboxId}-option-${index}`

    const toggleDropdown = () => {
        setIsOpen(!isOpen)
    }

    const handleDebouncedSearch = useCallback(
        debounce((value) => {
            onSearch?.(value)
            setLocalLoading(false)
        }, debounceDelay ?? 1000),
        []
    )

    const handleChangeInput = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value

        if (value.length >= minLength) {
            setLocalLoading(true)
        } else {
            setLocalLoading(false)
        }

        setSearch(value)

        if (value === '' && isOpen) {
            setIsOpen(false)
        }

        if (debouncing) {
            handleDebouncedSearch(value)
        } else {
            onSearch?.(value)
            setLocalLoading(false)
        }
    }

    const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown') {
            if (isOpen && options?.length) {
                event.preventDefault()
                setHighlightedIndex((prev) => (prev + 1 >= options.length ? 0 : prev + 1))
            }
            return
        }

        if (event.key === 'ArrowUp') {
            if (isOpen && options?.length) {
                event.preventDefault()
                setHighlightedIndex((prev) => (prev <= 0 ? options.length - 1 : prev - 1))
            }
            return
        }

        if (event.key === 'Escape') {
            if (isOpen) {
                setIsOpen(false)
            }
            return
        }

        if (event.key !== 'Enter') {
            return
        }

        if (onEnterPress) {
            event.preventDefault()

            if (isOpen && options?.length && highlightedIndex >= 0) {
                handleSelect(options[highlightedIndex])
            } else {
                onEnterPress(search ?? '')
            }
        } else if (options?.length && search) {
            handleSelect(options[highlightedIndex >= 0 ? highlightedIndex : 0])
        }
    }

    const handleSelect = (option: AutocompleteOption<T> | undefined) => {
        if (selectedOption?.title !== option?.title) {
            setSelectedOption(option)
            setSearch(option?.title)
        }

        onSelect?.(option)

        setIsOpen(false)
    }

    const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setIsOpen(false)
        }
    }

    const handleClearClick = (event: React.MouseEvent) => {
        event.stopPropagation()
        setSearch(undefined)
        handleSelect(undefined)
        onClear?.()
    }

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside)

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    useEffect(() => {
        if (!value) {
            setSelectedOption(undefined)
        }

        if (value) {
            const foundOption = options?.find(({ value: v }) => v === value)

            setSearch(foundOption?.title ?? '')
            setSelectedOption(foundOption)
        }
    }, [value])

    useEffect(() => {
        if (search && !suppressDropdown) {
            setIsOpen(true)
        }

        setHighlightedIndex(-1)
    }, [options])

    useEffect(() => {
        if (suppressDropdown) {
            setIsOpen(false)
        }
    }, [suppressDropdown])

    useEffect(() => {
        if (!isOpen) {
            setHighlightedIndex(-1)
        }
    }, [isOpen])

    useEffect(() => {
        if (externalInputValue !== undefined) {
            setSearch(externalInputValue)
        }
    }, [externalInputValue])

    return (
        <div
            ref={dropdownRef}
            className={cn(className, styles.autocomplete)}
        >
            {label && <label className={styles.label}>{label}</label>}
            <div className={cn(styles.container, isOpen && styles.open, disabled && styles.disabled)}>
                <div className={styles.searchContainer}>
                    {leftIcon && (
                        <span className={styles.leftIcon}>
                            <Icon name={leftIcon} />
                        </span>
                    )}
                    <input
                        type={'text'}
                        value={search || ''}
                        className={styles.searchInput}
                        placeholder={placeholder ?? ''}
                        autoFocus={autoFocus}
                        role={'combobox'}
                        aria-expanded={isOpen}
                        aria-controls={listboxId}
                        aria-autocomplete={'list'}
                        aria-activedescendant={
                            isOpen && highlightedIndex >= 0 ? getOptionId(highlightedIndex) : undefined
                        }
                        onMouseMove={(e) => e.stopPropagation()}
                        onWheelCapture={(e) => e.stopPropagation()}
                        onKeyDown={handleKeyPress}
                        onChange={handleChangeInput}
                    />
                    <span className={styles.arrow}>
                        {loading || localLoading ? (
                            <Spinner className={styles.loader} />
                        ) : clearable && selectedOption?.title ? (
                            <button
                                className={styles.clear}
                                type={'button'}
                                aria-label={t('clear', { defaultValue: 'Очистить' })}
                                onClick={handleClearClick}
                            >
                                <Icon name={'Close'} />
                            </button>
                        ) : !hideArrow ? (
                            <button
                                className={styles.toggleButton}
                                type={'button'}
                                aria-label={
                                    isOpen
                                        ? t('autocomplete-collapse', { defaultValue: 'Свернуть список' })
                                        : t('autocomplete-expand', { defaultValue: 'Развернуть список' })
                                }
                                onClick={toggleDropdown}
                            >
                                {isOpen ? <Icon name={'KeyboardUp'} /> : <Icon name={'KeyboardDown'} />}
                            </button>
                        ) : (
                            <></>
                        )}
                    </span>
                </div>
                {isOpen && !loading && (
                    <ul
                        id={listboxId}
                        role={'listbox'}
                        className={styles.optionsList}
                        onWheelCapture={(e) => e.stopPropagation()}
                    >
                        {!options?.length && <li className={styles.emptyItem}>{notFoundCaption ?? 'Nothing found'}</li>}
                        {options?.map((option, i) => (
                            <li
                                key={`option${i}`}
                                id={getOptionId(i)}
                                role={'option'}
                                aria-selected={
                                    option.title === selectedOption?.title && option.type === selectedOption?.type
                                }
                                className={cn(
                                    option.title === selectedOption?.title &&
                                        option.type === selectedOption.type &&
                                        styles.active,
                                    i === highlightedIndex && styles.highlighted
                                )}
                            >
                                <button
                                    onClick={() => handleSelect(option)}
                                    onMouseMove={(e) => e.stopPropagation()}
                                >
                                    <div className={styles.content}>
                                        {option.image && (
                                            <Image
                                                className={styles.optionImage}
                                                src={option.image.src}
                                                alt={''}
                                                width={16}
                                                height={16}
                                            />
                                        )}
                                        <span>{option.title}</span>
                                    </div>
                                    {option.description && (
                                        <div className={styles.description}>{option.description}</div>
                                    )}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    )
}
