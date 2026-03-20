import React from 'react'
import { Skeleton } from 'simple-react-ui-kit'

import styles from './styles.module.sass'

export const PlacesListItemLoader: React.FC = () => (
    <article className={styles.placesListItem}>
        <div
            className={styles.photoSection}
            style={{ marginBottom: '10px' }}
        >
            <Skeleton style={{ height: '100%', width: '100%' }} />
        </div>

        {Array(7)
            .fill('')
            .map((_, i) => (
                <Skeleton
                    key={i}
                    style={{
                        height: '13px',
                        margin: '0 10px 5px 10px',
                        width: i === 6 ? '85%' : '94%'
                    }}
                />
            ))}
    </article>
)
