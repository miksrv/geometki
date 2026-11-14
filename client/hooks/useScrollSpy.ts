import { useCallback, useEffect, useRef, useState } from 'react'

// The line under the app bar a part's top passes to become the current one; a click stops the
// part at 64px (its `scroll-margin-top`)
const SPY_OFFSET = 80
// No scroll events for this long: a click's smooth scroll is over, ms
const SCROLL_IDLE = 150

/**
 * Scroll spy for a menu of a page's parts (the parts of a page form, the sections of an
 * article): `active` is the last part whose top has reached the line under the app bar; at the
 * end of the page — the last part, which may be too short to reach it. The parts are looked up
 * by id on each scroll, so they may appear after the menu (a skeleton). `scrollTo` scrolls
 * smoothly to a part and marks it at once; the mark does not run through the parts the scroll
 * passes. It adds no history entry: the caller decides about the URL.
 */
export const useScrollSpy = (ids: string[]): { active: string | undefined; scrollTo: (id: string) => boolean } => {
    const [active, setActive] = useState<string | undefined>(ids[0])

    // The part a click is scrolling to
    const scrollTarget = useRef<string>(undefined)
    const release = useRef<ReturnType<typeof setTimeout>>(undefined)

    const key = ids.join()

    useEffect(() => {
        let frame = 0

        const update = () => {
            frame = 0

            // Scrolled to the very end of a page that scrolls at all
            const atEnd =
                window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
            const passed = ids.filter(
                (id) => (document.getElementById(id)?.getBoundingClientRect().top ?? Infinity) <= SPY_OFFSET
            )
            const current = atEnd ? ids[ids.length - 1] : (passed[passed.length - 1] ?? ids[0])

            if (scrollTarget.current) {
                // The click's scroll is over when it stops: no scroll events for a moment
                clearTimeout(release.current)
                release.current = setTimeout(() => {
                    scrollTarget.current = undefined
                    update()
                }, SCROLL_IDLE)

                return
            }

            if (current) {
                setActive(current)
            }
        }

        const onScroll = () => {
            if (!frame) {
                frame = requestAnimationFrame(update)
            }
        }

        update()
        window.addEventListener('scroll', onScroll, { passive: true })
        window.addEventListener('resize', onScroll)

        return () => {
            cancelAnimationFrame(frame)
            clearTimeout(release.current)
            window.removeEventListener('scroll', onScroll)
            window.removeEventListener('resize', onScroll)
        }
    }, [key])

    const scrollTo = useCallback((id: string): boolean => {
        const target = document.getElementById(id)

        if (!target) {
            return false
        }

        scrollTarget.current = id
        // Let go even if the part is already in place and nothing scrolls
        clearTimeout(release.current)
        release.current = setTimeout(() => (scrollTarget.current = undefined), SCROLL_IDLE * 4)
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        setActive(id)

        return true
    }, [])

    return { active, scrollTo }
}
