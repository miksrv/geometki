import React, { useEffect, useRef, useState } from 'react'
import { Button, cn } from 'simple-react-ui-kit'

import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'
import { Autocomplete } from '@/components/ui'
import useSiteSearch from '@/hooks/useSiteSearch'

import styles from './styles.module.sass'

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

    const { reset, ...search } = useSiteSearch()
    const [overlayOpen, setOverlayOpen] = useState<boolean>(false)
    const overlayRef = useRef<HTMLDivElement>(null)
    // Element that opened the overlay; Button (simple-react-ui-kit) doesn't accept a ref
    const triggerButtonRef = useRef<HTMLElement | null>(null)

    const handleOpenOverlay = (event: React.MouseEvent<HTMLButtonElement>) => {
        triggerButtonRef.current = event.currentTarget
        setOverlayOpen(true)
    }

    const handleCloseOverlay = () => {
        setOverlayOpen(false)
        reset()
        triggerButtonRef.current?.focus()
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
            autoFocus={autoFocus}
            {...search}
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
                tooltip={placeholder}
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
                                tooltip={t('close-search', { defaultValue: 'Закрыть поиск' })}
                                onClick={handleCloseOverlay}
                            />
                        </>
                    )}
                </div>
            </div>
        </>
    )
}
