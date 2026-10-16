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
            <Skeleton style={{ height: '16px', marginTop: '12px', width: '85%' }} />
            <Skeleton style={{ height: '13px', marginTop: '8px', width: '60%' }} />
            <div className={styles.tileStats}>
                <Skeleton style={{ height: '12px', width: '36px' }} />
                <Skeleton style={{ height: '12px', width: '48px' }} />
                <Skeleton style={{ height: '12px', width: '28px' }} />
            </div>
        </article>
    )
}
