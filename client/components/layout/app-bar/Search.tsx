import React, { useEffect, useRef, useState } from 'react'
import { Button } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { SiteSearch, SiteSearchHandle, SiteSearchScreen } from '@/components/shared/site-search'

import styles from './styles.module.sass'

/** The width from which the field is in the bar (`$inlineSearchMinWidth` in the styles) */
const INLINE_MIN_WIDTH = 1024

const isTypingInto = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

/**
 * The site search of the app bar. Wide screens: the `SiteSearch` field in the bar; narrower
 * ones: an icon button that opens the full-screen search. "/" (outside text fields) and
 * Ctrl/⌘ K open it from anywhere, on any keyboard layout.
 */
export const Search: React.FC = () => {
    const { t } = useTranslation()

    const fieldRef = useRef<SiteSearchHandle>(null)
    const [screenOpen, setScreenOpen] = useState<boolean>(false)

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const isSlash =
                (event.key === '/' || (event.code === 'Slash' && !event.shiftKey)) &&
                !event.metaKey &&
                !event.ctrlKey &&
                !event.altKey &&
                !isTypingInto(event.target)
            const isCommandK = (event.metaKey || event.ctrlKey) && event.code === 'KeyK'

            if (!isSlash && !isCommandK) {
                return
            }

            event.preventDefault()

            if (window.matchMedia(`(min-width: ${INLINE_MIN_WIDTH}px)`).matches) {
                fieldRef.current?.focus()
            } else {
                setScreenOpen(true)
            }
        }

        document.addEventListener('keydown', handleKeyDown)

        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [])

    const placeholder = t('global-search-placeholder', 'Места, города, координаты')

    return (
        <>
            <div className={styles.searchInline}>
                <SiteSearch
                    ref={fieldRef}
                    variant={'bar'}
                    placeholder={placeholder}
                />
            </div>

            <Button
                mode={'outline'}
                icon={'Search'}
                size={'medium'}
                className={styles.searchButton}
                aria-label={placeholder}
                tooltip={placeholder}
                onClick={() => setScreenOpen(true)}
            />

            <SiteSearchScreen
                open={screenOpen}
                placeholder={placeholder}
                onClose={() => setScreenOpen(false)}
            />
        </>
    )
}
