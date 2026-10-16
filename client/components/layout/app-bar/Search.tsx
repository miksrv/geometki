import React, { useEffect, useRef, useState } from 'react'
import { Button, cn } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'
import { useTranslation } from 'next-i18next/pages'

import { SiteSearch, SiteSearchHandle } from '@/components/shared/site-search'

import styles from './styles.module.sass'

// The full-screen search renders only when opened: its code is not in the first load
const SiteSearchScreen = dynamic(
    () => import('@/components/shared/site-search/SiteSearchScreen').then((module) => module.SiteSearchScreen),
    { ssr: false }
)

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
            // Neither shortcut is taken inside text fields and editors (Ctrl/⌘ K is a link in Markdown)
            if (isTypingInto(event.target)) {
                return
            }

            const isSlash =
                (event.key === '/' || (event.code === 'Slash' && !event.shiftKey)) &&
                !event.metaKey &&
                !event.ctrlKey &&
                !event.altKey
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
                mode={'link'}
                icon={'Search'}
                size={'medium'}
                className={cn(styles.searchButton, styles.iconButton)}
                aria-label={placeholder}
                tooltip={placeholder}
                onClick={() => setScreenOpen(true)}
            />

            {screenOpen && (
                <SiteSearchScreen
                    open={true}
                    placeholder={placeholder}
                    onClose={() => setScreenOpen(false)}
                />
            )}
        </>
    )
}
