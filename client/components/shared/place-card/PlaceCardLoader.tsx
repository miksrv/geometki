import React from 'react'
import { cn, Skeleton } from 'simple-react-ui-kit'

import { mediaTileStyles } from '@/components/shared/media-tile'

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
            className={mediaTileStyles.tile}
            aria-hidden={true}
        >
            <Skeleton style={{ position: 'absolute', inset: 0 }} />

            <div className={mediaTileStyles.bottomOverlay}>
                <Skeleton style={{ height: '22px', width: '85px', borderRadius: '20px', marginBottom: '7px' }} />
                <Skeleton style={{ height: '13px', width: '95%', marginBottom: '5px' }} />
                <Skeleton style={{ height: '13px', width: '65%', marginBottom: '4px' }} />
                <Skeleton style={{ height: '11px', width: '70%', marginBottom: '8px' }} />
                <div className={mediaTileStyles.stats}>
                    <Skeleton style={{ height: '11px', width: '30px' }} />
                    <Skeleton style={{ height: '11px', width: '30px' }} />
                    <Skeleton style={{ height: '11px', width: '30px' }} />
                </div>
            </div>
        </article>
    )
}
