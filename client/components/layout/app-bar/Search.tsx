import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button, cn } from 'simple-react-ui-kit'

import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiType } from '@/api'
import { Autocomplete, AutocompleteOption } from '@/components/ui'

import styles from './styles.module.sass'

enum SuggestionType {
    PLACE = 'place',
    LOCATION = 'location',
    COORDINATES = 'coordinates'
}

/**
 * Global site search.
 *
 * On wide screens the autocomplete field is always visible in the app bar.
 * On narrow screens it collapses into an icon button that opens a full-width
 * overlay with the same field, so the app bar stays uncluttered.
 */
export const Search: React.FC = () => {
    const { t } = useTranslation()
    const router = useRouter()

    const urlQuery = (router.query.q as string) ?? ''
    const [inputValue, setInputValue] = useState<string>(urlQuery)
    const [overlayOpen, setOverlayOpen] = useState<boolean>(false)
    const overlayRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        setInputValue(urlQuery)
    }, [urlQuery])

    const isOnSearchPage = router.pathname === '/search'
    const inputMatchesUrl = inputValue.trim() === urlQuery.trim()
    const skipSuggestions = isOnSearchPage && inputMatchesUrl

    const { data: suggestData, isFetching } = API.useSearchSuggestQuery(inputValue, {
        skip: inputValue.length < 2 || skipSuggestions
    })

    const options = useMemo<Array<AutocompleteOption<ApiType.Search.Suggestion>>>(
        () =>
            suggestData?.suggestions?.map((suggestion) => {
                if (suggestion.type === SuggestionType.PLACE) {
                    return {
                        title: suggestion.title,
                        type: SuggestionType.PLACE,
                        value: suggestion
                    }
                }

                if (suggestion.type === SuggestionType.LOCATION) {
                    return {
                        title: suggestion.title,
                        type: SuggestionType.LOCATION,
                        value: suggestion
                    }
                }

                return {
                    title: `${suggestion.lat}, ${suggestion.lon}`,
                    type: SuggestionType.COORDINATES,
                    value: suggestion
                }
            }) ?? [],
        [suggestData?.suggestions]
    )

    const handleOpenOverlay = () => {
        setOverlayOpen(true)
    }

    const handleCloseOverlay = () => {
        setOverlayOpen(false)
        setInputValue(urlQuery)
    }

    const handleSearch = (value: string) => {
        setInputValue(value)
    }

    const navigateToSearch = async (q: string) => {
        const trimmed = q.trim()

        if (trimmed) {
            await router.push(`/search?q=${encodeURIComponent(trimmed)}`)
        }
    }

    const handleSelect = async (option?: AutocompleteOption<ApiType.Search.Suggestion>) => {
        if (!option) {
            return
        }

        const suggestion = option.value

        if (suggestion.type === SuggestionType.PLACE) {
            await router.push(`/places/${suggestion.id}`)
            return
        }

        const zoom = suggestion.type === SuggestionType.COORDINATES ? 14 : 12
        const hash = `${suggestion.lat},${suggestion.lon},${zoom}?m=${suggestion.lat},${suggestion.lon}`

        if (router.pathname === '/map') {
            await router.replace({ hash, pathname: '/map' })
        } else {
            await router.push(`/map#${hash}`)
        }
    }

    // Close the mobile overlay on Escape and on outside click
    useEffect(() => {
        if (!overlayOpen) {
            return
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                handleCloseOverlay()
            }
        }

        const handleMouseDown = (event: MouseEvent) => {
            if (overlayRef.current && !overlayRef.current.contains(event.target as Node)) {
                handleCloseOverlay()
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        document.addEventListener('mousedown', handleMouseDown)

        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            document.removeEventListener('mousedown', handleMouseDown)
        }
    }, [overlayOpen])

    // Close the mobile overlay after navigation
    useEffect(() => {
        setOverlayOpen(false)
    }, [router.asPath])

    const placeholder = t('global-search-placeholder', { defaultValue: 'Поиск мест, координат' })

    const renderField = (autoFocus?: boolean) => (
        <Autocomplete<ApiType.Search.Suggestion>
            className={styles.search}
            notFoundCaption={t('nothing-found', { defaultValue: 'Ничего не найдено' })}
            placeholder={placeholder}
            debounceDelay={300}
            leftIcon={'Search'}
            hideArrow={!options.length || !inputValue.length}
            loading={isFetching}
            inputValue={inputValue}
            options={options}
            autoFocus={autoFocus}
            onSearch={handleSearch}
            onSelect={handleSelect}
            suppressDropdown={skipSuggestions}
            onEnterPress={(value) => void navigateToSearch(value)}
        />
    )

    return (
        <>
            <div
                className={styles.searchInline}
                role={'search'}
            >
                {renderField()}
            </div>

            <Button
                mode={'outline'}
                icon={'Search'}
                size={'medium'}
                className={styles.searchButton}
                aria-label={placeholder}
                title={placeholder}
                onClick={handleOpenOverlay}
            />

            <div
                className={cn(styles.searchOverlay, overlayOpen && styles.searchOverlayOpen)}
                role={'search'}
                aria-hidden={!overlayOpen}
            >
                <div
                    ref={overlayRef}
                    className={styles.searchOverlayInner}
                >
                    {overlayOpen && (
                        <>
                            {renderField(true)}

                            <Button
                                mode={'outline'}
                                icon={'Close'}
                                size={'medium'}
                                aria-label={t('close', { defaultValue: 'Закрыть' })}
                                onClick={handleCloseOverlay}
                            />
                        </>
                    )}
                </div>
            </div>
        </>
    )
}
