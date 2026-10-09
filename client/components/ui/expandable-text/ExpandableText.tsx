import React, { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { cn } from 'simple-react-ui-kit'

import { MOBILE_MAX_WIDTH } from '@/config/constants'

import styles from './styles.module.sass'

const ELLIPSIS = '…'

interface ExpandableTextProps {
    text: string
    /** Lines shown while collapsed on wide screens */
    lines?: number
    /** Lines shown while collapsed on phones */
    mobileLines?: number
    /** Label of the expand control, e.g. "Подробнее" */
    moreLabel: string
    className?: string
}

/** The line height in px the element is laid out with (jsdom has none — falls back to 1.5 × font size) */
const resolveLineHeight = (el: HTMLElement): number => {
    const style = window.getComputedStyle(el)
    const lineHeight = parseFloat(style.lineHeight)

    if (Number.isFinite(lineHeight) && lineHeight > 0) {
        return lineHeight
    }

    const fontSize = parseFloat(style.fontSize)

    return Number.isFinite(fontSize) && fontSize > 0 ? fontSize * 1.5 : 0
}

/**
 * A paragraph that shows at most N lines, ending with "… Подробнее" on the last visible line
 * (DESIGN.md → Patterns → Expandable text). The cut is found by measurement, not by CSS
 * clamping: a hidden twin of the paragraph is laid out with ever shorter prefixes of the
 * text (binary search, trimmed to a word) until the prefix plus the ellipsis and the control
 * fit the line budget — so the control never drops to its own line and never hides a single
 * word behind a whole extra line. Re-measured on resize and once fonts load. A text that
 * fits as it is gets no control. Expanding is one-way.
 *
 * Until measured (SSR, no JS) the full text is CSS-clamped to the same number of lines.
 * Typography (size, colour) comes from the parent via `className`.
 *
 * A kit primitive candidate.
 */
export const ExpandableText: React.FC<ExpandableTextProps> = ({
    text,
    lines = 3,
    mobileLines = 2,
    moreLabel,
    className
}) => {
    const [expanded, setExpanded] = useState(false)
    // undefined: not measured yet; null: the whole text fits; number: characters shown before "…"
    const [cut, setCut] = useState<number | null | undefined>(undefined)
    const rootRef = useRef<HTMLDivElement>(null)
    const measurerRef = useRef<HTMLParagraphElement>(null)

    const measure = useCallback(() => {
        const measurer = measurerRef.current

        if (!measurer) {
            return
        }

        const lineHeight = resolveLineHeight(measurer)

        if (!lineHeight) {
            return
        }

        const limit = window.matchMedia?.(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches ? mobileLines : lines
        const maxHeight = lineHeight * limit + 1

        const fits = (prefix: string, withControl: boolean): boolean => {
            measurer.textContent = withControl ? `${prefix}${ELLIPSIS} ${moreLabel}` : prefix

            return measurer.offsetHeight <= maxHeight
        }

        if (fits(text, false)) {
            measurer.textContent = ''
            setCut(null)
            return
        }

        let low = 0
        let high = text.length

        while (low < high) {
            const middle = Math.ceil((low + high) / 2)

            if (fits(text.slice(0, middle).trimEnd(), true)) {
                low = middle
            } else {
                high = middle - 1
            }
        }

        // Never cut inside a word: back up to the last space, unless that leaves nothing
        const lastSpace = text.lastIndexOf(' ', low)
        measurer.textContent = '' // leave no second copy of the text in the DOM
        setCut(lastSpace > 0 ? lastSpace : low)
    }, [text, lines, mobileLines, moreLabel])

    useLayoutEffect(() => {
        if (expanded) {
            return
        }

        measure()

        const root = rootRef.current
        const observer = typeof ResizeObserver !== 'undefined' && root ? new ResizeObserver(measure) : null
        observer?.observe(root as Element)

        // Web fonts change the metrics after the first layout
        void document.fonts?.ready.then(measure)

        return () => observer?.disconnect()
    }, [expanded, measure])

    if (!text) {
        return null
    }

    const collapsed = !expanded && typeof cut === 'number'

    return (
        <div
            ref={rootRef}
            className={cn(styles.component, className)}
        >
            <p
                className={cn(styles.text, !expanded && cut === undefined && styles.clamped)}
                style={{ '--lines': lines, '--lines-mobile': mobileLines } as React.CSSProperties}
            >
                {collapsed ? text.slice(0, cut).trimEnd() : text}
                {collapsed && (
                    <>
                        {ELLIPSIS}{' '}
                        <button
                            type={'button'}
                            className={styles.more}
                            onClick={() => setExpanded(true)}
                        >
                            {moreLabel}
                        </button>
                    </>
                )}
            </p>
            <p
                ref={measurerRef}
                aria-hidden={true}
                className={cn(styles.text, styles.measurer)}
            />
        </div>
    )
}
