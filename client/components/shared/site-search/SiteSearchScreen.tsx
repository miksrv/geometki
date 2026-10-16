import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { useRouter } from 'next/router'

import { SiteSearch } from './SiteSearch'

import styles from './styles.module.sass'

interface SiteSearchScreenProps {
    open: boolean
    placeholder?: string
    onClose: () => void
}

/**
 * The site search over the whole screen of a phone: the field with a back button on top, the
 * suggestions under it with the room the keyboard leaves. The page under it does not scroll;
 * it closes on the back button, Escape and any navigation.
 */
export const SiteSearchScreen: React.FC<SiteSearchScreenProps> = ({ open, placeholder, onClose }) => {
    const router = useRouter()
    // The portal target exists on the client only: the server renders nothing
    const [mounted, setMounted] = useState<boolean>(false)

    useEffect(() => setMounted(true), [])

    useEffect(() => {
        if (open) {
            onClose()
        }
    }, [router.asPath])

    useEffect(() => {
        if (!open) {
            return
        }

        const previouslyFocused = document.activeElement as HTMLElement | null
        const overflow = document.body.style.overflow

        document.body.style.overflow = 'hidden'

        return () => {
            document.body.style.overflow = overflow
            previouslyFocused?.focus?.()
        }
    }, [open])

    if (!mounted || !open) {
        return null
    }

    return createPortal(
        <div
            className={styles.screenLayer}
            role={'dialog'}
            aria-modal={true}
            aria-label={placeholder}
        >
            <SiteSearch
                variant={'screen'}
                placeholder={placeholder}
                autoFocus={true}
                onClose={onClose}
            />
        </div>,
        document.body
    )
}
