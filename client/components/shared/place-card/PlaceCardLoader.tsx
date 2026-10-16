import React from 'react'
import { cn, Skeleton } from 'simple-react-ui-kit'

import { PlaceCardVariant } from './PlaceCard'

import styles from './styles.module.sass'

interface PlaceCardLoaderProps {
    variant?: PlaceCardVariant
    size?: 'medium' | 'small'
}

/** Skeleton with the same geometry as PlaceCard, so lists do not jump when data arrives */
export const PlaceCardLoader: React.FC<PlaceCardLoaderProps> = ({ variant = 'tile', size = 'medium' }) => {
    if (variant === 'row') {
        return (
            <article
                className={cn(styles.row, size === 'small' && styles.small)}
                aria-hidden={true}
            >
                <div className={styles.thumbLink}>
                    <Skeleton style={{ position: 'absolute', inset: 0 }} />
                </div>
                <div className={styles.body}>
                    <Skeleton style={{ height: '14px', width: '70%' }} />
                    <Skeleton style={{ height: '18px', width: '80px', borderRadius: '20px' }} />
                    <Skeleton style={{ height: '12px', width: '50%' }} />
                </div>
            </article>
        )
    }

    return (
        <article
            className={styles.tile}
            aria-hidden={true}
        >
            <div className={styles.tileCover}>
                <Skeleton style={{ inset: 0, position: 'absolute' }} />
            </div>
            {/* Heights of the real lines: 16px × 1.3 title, 13px × 1.45 address and stats */}
            <Skeleton style={{ height: '21px', margin: '10px 0 2px', width: '85%' }} />
            <Skeleton style={{ height: '19px', width: '60%' }} />
            <div
                className={styles.tileStats}
                style={{ alignItems: 'center', minHeight: '19px' }}
            >
                <Skeleton style={{ height: '12px', width: '36px' }} />
                <Skeleton style={{ height: '12px', width: '48px' }} />
                <Skeleton style={{ height: '12px', width: '28px' }} />
            </div>
        </article>
    )
}
