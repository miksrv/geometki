import React from 'react'
import { Skeleton } from 'simple-react-ui-kit'

import styles from './styles.module.sass'

export const ActivityListItemLoader: React.FC = () => (
    <div className={styles.activityItem}>
        <div className={styles.header}>
            <Skeleton
                style={{
                    borderRadius: '50%',
                    height: '32px',
                    width: '32px',
                    flexShrink: 0
                }}
            />
            <div style={{ flex: 1 }}>
                <Skeleton
                    style={{
                        height: '14px',
                        marginBottom: '6px',
                        width: '140px'
                    }}
                />
                <Skeleton
                    style={{
                        height: '12px',
                        width: '80px'
                    }}
                />
            </div>
        </div>

        {Array(3)
            .fill('')
            .map((_, i) => (
                <Skeleton
                    key={i}
                    style={{
                        height: '16px',
                        marginBottom: '5px',
                        width: i === 2 ? '60%' : '100%'
                    }}
                />
            ))}

        <Skeleton
            style={{
                height: '14px',
                marginTop: '10px',
                width: '120px'
            }}
        />
    </div>
)
