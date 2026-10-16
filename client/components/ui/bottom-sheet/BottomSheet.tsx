import React, { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from 'simple-react-ui-kit'

import styles from './styles.module.sass'

export interface BottomSheetProps {
    open: boolean
    /** Heading of the sheet; also its accessible name */
    title?: string
    className?: string
    children?: React.ReactNode
    /** Pinned under the scrolling content: the buttons of a form sheet ("Сбросить", "Показать") */
    footer?: React.ReactNode
    /**
     * A menu (default) closes on any chosen row; a form sheet (filters) keeps open while its
     * controls are used and closes from its own footer
     */
    closeOnSelect?: boolean
    onClose: () => void
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * A menu that slides up from the bottom edge of a phone screen, over a dimmed page: the
 * actions of a bottom bar, where a dropdown would open off the screen. Closes on the
 * backdrop, Escape and any link or button inside; focus moves in and comes back to the
 * trigger. Rows of `ul > li > a | button` inside get 48px touch targets. A form sheet
 * (`closeOnSelect={false}` + `footer`) stays open until its own buttons close it. A kit primitive
 * candidate (`simple-react-ui-kit` has `Popout` only, which always opens downwards).
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({
    open,
    title,
    className,
    children,
    footer,
    closeOnSelect = true,
    onClose
}) => {
    const titleId = useId()
    const sheetRef = useRef<HTMLDivElement>(null)
    // The portal target exists on the client only: the server renders nothing
    const [mounted, setMounted] = useState<boolean>(false)

    useEffect(() => setMounted(true), [])

    useEffect(() => {
        // Waits for the portal too: a sheet open from the first render has no node before it
        if (!open || !mounted) {
            return
        }

        const previouslyFocused = document.activeElement as HTMLElement | null
        const overflow = document.body.style.overflow

        document.body.style.overflow = 'hidden'
        sheetRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose()
            }
        }

        document.addEventListener('keydown', handleKeyDown)

        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            document.body.style.overflow = overflow
            previouslyFocused?.focus?.()
        }
    }, [open, mounted])

    // A chosen row is the end of the menu: links navigate, buttons act, the sheet goes away
    const handleClick = (event: React.MouseEvent) => {
        if (closeOnSelect && (event.target as HTMLElement).closest('a, button')) {
            onClose()
        }
    }

    if (!mounted || !open) {
        return null
    }

    return createPortal(
        <div className={styles.root}>
            <div
                className={styles.backdrop}
                aria-hidden={true}
                onClick={onClose}
            />
            <div
                ref={sheetRef}
                role={'dialog'}
                aria-modal={true}
                aria-labelledby={title ? titleId : undefined}
                className={cn(styles.sheet, className)}
                onClick={handleClick}
            >
                <span
                    className={styles.handle}
                    aria-hidden={true}
                />
                {title && (
                    <div
                        id={titleId}
                        className={styles.title}
                    >
                        {title}
                    </div>
                )}
                <div className={styles.content}>{children}</div>
                {footer && <div className={styles.footer}>{footer}</div>}
            </div>
        </div>,
        document.body
    )
}
