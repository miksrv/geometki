import React from 'react'
import { Skeleton } from 'simple-react-ui-kit'

import styles from './styles.module.sass'

export const PlacesListItemLoader: React.FC = () => (
    <article className={styles.placesListItem}>
        <Skeleton style={{ position: 'absolute', inset: 0 }} />

        {/* Author skeleton — top */}
        <div className={styles.topOverlay}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Skeleton style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0 }} />
                <div>
                    <Skeleton style={{ height: '11px', width: '80px', marginBottom: '4px' }} />
                    <Skeleton style={{ height: '10px', width: '55px' }} />
                </div>
            </div>
        </div>

        {/* Content skeleton — bottom */}
        <div className={styles.bottomOverlay}>
            <Skeleton style={{ height: '22px', width: '85px', borderRadius: '20px', marginBottom: '7px' }} />
            <Skeleton style={{ height: '13px', width: '95%', marginBottom: '5px' }} />
            <Skeleton style={{ height: '13px', width: '65%', marginBottom: '4px' }} />
            <Skeleton style={{ height: '11px', width: '70%', marginBottom: '8px' }} />
            <div
                style={{
                    display: 'flex',
                    gap: '10px',
                    paddingTop: '7px',
                    borderTop: '1px solid rgba(255,255,255,0.2)'
                }}
            >
                <Skeleton style={{ height: '11px', width: '30px' }} />
                <Skeleton style={{ height: '11px', width: '30px' }} />
                <Skeleton style={{ height: '11px', width: '30px' }} />
            </div>
        </div>
    </article>
)
