import React from 'react'
import { cn } from 'simple-react-ui-kit'

import { ApiModel } from '@/api'

import styles from './styles.module.sass'

/** The glyph of each badge on a 10×10 grid: a check, a bookmark */
const GLYPHS: Record<ApiModel.PlaceMarkBadge, string> = {
    bookmark: '<path d="M3.2 2h3.6v6L5 6.7 3.2 8z" fill="currentColor"/>',
    visited: '<path d="M2.4 5.2l1.8 1.8 3.4-3.6"/>'
}

const SVG = (tone: ApiModel.PlaceMarkBadge) =>
    `<svg viewBox="0 0 10 10" focusable="false" aria-hidden="true">${GLYPHS[tone]}</svg>`

/**
 * What a person did with a place, a round badge on the corner of its map marker: visited — a
 * green check, kept in bookmarks — an orange bookmark; the places they added are plain markers.
 * The colour and the glyph both tell it (not the colour alone). The same badge in a chip is the
 * legend of the map.
 */
export const toneBadgeHtml = (tone: ApiModel.PlaceMarkBadge): string =>
    `<span class="${styles.badge} ${styles.onMarker} ${styles[tone]}">${SVG(tone)}</span>`

interface ToneBadgeProps {
    tone: ApiModel.PlaceMarkBadge
    className?: string
}

/** The badge in a line of text: the chips over the person's map */
export const ToneBadge: React.FC<ToneBadgeProps> = ({ tone, className }) => (
    <span
        className={cn(styles.badge, styles[tone], className)}
        aria-hidden={true}
        // A fixed glyph of this file, never data
        dangerouslySetInnerHTML={{ __html: SVG(tone) }}
    />
)
