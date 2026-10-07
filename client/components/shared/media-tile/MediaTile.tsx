import React from 'react'
import { cn } from 'simple-react-ui-kit'

import Image from 'next/image'
import Link from 'next/link'

import styles from './styles.module.sass'

/** Covers in a mosaic beyond this are ignored */
export const MOSAIC_MAX = 4

export interface MediaTileProps {
    /** Where the whole tile (and the title) leads */
    href: string
    title: string
    /** Cover image URL; the tile shows the "no image" placeholder without it */
    coverSrc?: string
    /**
     * Several cover URLs drawn as a mosaic (1 — the whole tile, 2 — two columns,
     * 3 — one tall on the left and two stacked on the right, 4 — a 2×2 grid). Takes
     * precedence over `coverSrc`; only the first four are used.
     */
    covers?: string[]
    /** Preload the cover (above-the-fold tiles only) */
    priority?: boolean
    /** Content of the top gradient band (collections show the author there, places the category icon) */
    top?: React.ReactNode
    /** Content of the bottom gradient band: title, subline, stats */
    children?: React.ReactNode
    className?: string
}

/**
 * Photo tile primitive: a cover that fills the card with gradient bands at the top and
 * bottom for overlay content. Every "entity on a cover" card (PlaceCard tile, CollectionCard)
 * is built on it, so the chrome — size, radius, gradients, hover zoom — is defined once.
 *
 * Overlay content uses the exported `mediaTileStyles` helpers (`title`, `subline`, `stats`,
 * `stat`, `author`) to stay white-on-gradient and consistent between entities.
 */
export const MediaTile: React.FC<MediaTileProps> = ({
    href,
    title,
    coverSrc,
    covers,
    priority,
    top,
    children,
    className
}) => {
    const mosaic = covers?.slice(0, MOSAIC_MAX)

    return (
        <article className={cn(styles.tile, className)}>
            {/* Full-card link — sits behind all overlays */}
            <Link
                href={href}
                title={title}
                className={styles.coverLink}
            >
                {mosaic?.length ? (
                    <div
                        className={styles.mosaic}
                        data-count={mosaic.length}
                    >
                        {mosaic.map((src, index) => (
                            <div
                                key={`${src}${index}`}
                                className={styles.mosaicCell}
                            >
                                <Image
                                    className={styles.cover}
                                    // One accessible name for the tile is enough — the link has the title
                                    alt={''}
                                    quality={75}
                                    fill
                                    priority={priority}
                                    sizes={
                                        mosaic.length === 1
                                            ? '(max-width: 768px) 100vw, 33vw'
                                            : '(max-width: 768px) 50vw, 17vw'
                                    }
                                    src={src}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    coverSrc && (
                        <Image
                            className={styles.cover}
                            alt={title}
                            quality={75}
                            fill
                            priority={priority}
                            sizes={'(max-width: 768px) 100vw, 33vw'}
                            src={coverSrc}
                        />
                    )
                )}
            </Link>

            {top && <div className={styles.topOverlay}>{top}</div>}

            <div className={styles.bottomOverlay}>{children}</div>
        </article>
    )
}

interface MediaTileGridProps {
    className?: string
    children?: React.ReactNode
}

/** 3-column flow of tiles (1 column on phones); the list itself sits on the page background */
export const MediaTileGrid: React.FC<MediaTileGridProps> = ({ className, children }) => (
    <section className={cn(styles.grid, className)}>{children}</section>
)

/** Overlay content classes for tiles — see MediaTile */
export const mediaTileStyles = {
    author: styles.author,
    stat: styles.stat,
    stats: styles.stats,
    subline: styles.subline,
    tile: styles.tile,
    title: styles.title,
    topOverlay: styles.topOverlay,
    bottomOverlay: styles.bottomOverlay
}
