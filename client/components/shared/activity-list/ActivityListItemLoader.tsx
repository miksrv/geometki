import React from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import styles from './styles.module.sass'

export const ActivityListItemLoader: React.FC = () => (
    <Container className={styles.activityContainer}>
        <div
            className={styles.userAvatar}
            style={{ display: 'flex' }}
        >
            <Skeleton
                style={{
                    borderRadius: '50%',
                    height: '32px',
                    width: '32px'
                }}
            />
            <div style={{ marginLeft: '10px' }}>
                <Skeleton
                    style={{
                        height: '16px',
                        marginBottom: '5px',
                        width: '100px'
                    }}
                />
                <Skeleton
                    style={{
                        height: '12px',
                        width: '200px'
                    }}
                />
            </div>
        </div>

        {Array(5)
            .fill('')
            .map((_, i) => (
                <Skeleton
                    key={i}
                    style={{
                        height: '16px',
                        marginBottom: '5px',
                        width: i === 4 ? '75%' : '100%'
                    }}
                />
            ))}
    </Container>
)
