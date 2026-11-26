import React from 'react'
import { cn } from 'simple-react-ui-kit'

import Link from 'next/link'

import styles from './styles.module.sass'

export interface StatTile {
    key: string
    /** The number, already formatted: "1 240", "+12", "—" */
    value: React.ReactNode
    /** The caption under the number */
    label: string
    /** A tile with a link leads to what it counts; without one it only informs */
    href?: string
    /** The colour of the number: the sign of a reputation */
    tone?: 'positive' | 'negative'
    /** The name for screen readers when the number and the caption do not say it */
    ariaLabel?: string
}

export interface StatTilesProps {
    items: StatTile[]
    /** What the numbers are about, for screen readers */
    'aria-label'?: string
    className?: string
}

/**
 * The counters of a card's head (DESIGN.md → StatTiles): equal `--surface-2` tiles in a row, a
 * big number over a caption — the profile card's places, photos, visits and reputation, the
 * season card's place and players. A tile with `href` is a link (the row is then a navigation);
 * without one it is plain information.
 */
export const StatTiles: React.FC<StatTilesProps> = ({ items, 'aria-label': ariaLabel, className }) => {
    const Wrapper = items.some(({ href }) => !!href) ? 'nav' : 'div'

    return (
        <Wrapper
            className={cn(styles.tiles, className)}
            style={{ '--stat-tiles': items.length } as React.CSSProperties}
            role={Wrapper === 'div' && ariaLabel ? 'group' : undefined}
            aria-label={ariaLabel}
        >
            {items.map(({ key, value, label, href, tone, ariaLabel: name }) => {
                const content = (
                    <>
                        <b className={tone ? styles[tone] : undefined}>{value}</b>
                        <span>{label}</span>
                    </>
                )

                return href ? (
                    <Link
                        key={key}
                        href={href}
                        className={cn(styles.tile, styles.link)}
                        aria-label={name}
                    >
                        {content}
                    </Link>
                ) : (
                    <div
                        key={key}
                        className={styles.tile}
                        aria-label={name}
                    >
                        {content}
                    </div>
                )
            })}
        </Wrapper>
    )
}
