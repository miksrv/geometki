import React, { useEffect, useRef, useState } from 'react'
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

    // The part of the screen the on-screen keyboard leaves: the layer is as high as it, so the last
    // rows are not under the keyboard
    const [viewport, setViewport] = useState<{ top: number; height: number } | null>(null)

    useEffect(() => setMounted(true), [])

    useEffect(() => {
        const visualViewport = window.visualViewport

        if (!open || !visualViewport) {
            return
        }

        const update = () => setViewport({ height: visualViewport.height, top: visualViewport.offsetTop })

        update()
        visualViewport.addEventListener('resize', update)
        visualViewport.addEventListener('scroll', update)

        return () => {
            visualViewport.removeEventListener('resize', update)
            visualViewport.removeEventListener('scroll', update)
            setViewport(null)
        }
    }, [open])

    // The path the screen was opened on: the screen closes on a navigation away from it, not on
    // the first render (the effect also runs on mount, when the screen is already open)
    const openedOnPath = useRef<string>(router.asPath)

    useEffect(() => {
        if (!open) {
            openedOnPath.current = router.asPath
            return
        }

        if (router.asPath !== openedOnPath.current) {
            onClose()
        }
    }, [open, router.asPath])

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
            style={viewport ? { bottom: 'auto', height: viewport.height, top: viewport.top } : undefined}
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
