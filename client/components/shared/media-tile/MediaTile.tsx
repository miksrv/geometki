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
    /** The cover's `sizes`: the default is the three-column grid; carousels pass their slide width */
    sizes?: string
    /** Content of the gradient band over the top of the cover (collections show the author there) */
    top?: React.ReactNode
    /** Text under the cover on the page background: the title and a line of facts */
    children?: React.ReactNode
    className?: string
}

/**
 * Photo tile primitive: a 260px cover (one picture or a mosaic) with an optional gradient
 * band over its top, and the text under it on the page background, like the PlaceCard tile.
 * The chrome — size, radius, hover zoom — is defined once.
 *
 * Text under the cover uses the exported `mediaTileStyles` helpers (`title`, `meta`,
 * `region`, `stat`); the author in the top band uses `author` to stay white on the gradient.
 */
export const MediaTile: React.FC<MediaTileProps> = ({
    href,
    title,
    coverSrc,
    covers,
    sizes = '(max-width: 768px) 100vw, 33vw',
    priority,
    top,
    children,
    className
}) => {
    const mosaic = covers?.slice(0, MOSAIC_MAX)

    return (
        <article className={cn(styles.tile, className)}>
            <div className={styles.media}>
                {/* Cover link — sits behind the top band */}
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
                                        fetchPriority={priority ? 'high' : undefined}
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
                                fetchPriority={priority ? 'high' : undefined}
                                sizes={sizes}
                                src={coverSrc}
                            />
                        )
                    )}
                </Link>

                {top && <div className={styles.topOverlay}>{top}</div>}
            </div>

            {children}
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

/** Content classes for tiles — see MediaTile */
export const mediaTileStyles = {
    author: styles.author,
    media: styles.media,
    meta: styles.meta,
    region: styles.region,
    stat: styles.stat,
    title: styles.title
}
