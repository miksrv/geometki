import React from 'react'
import { Skeleton } from 'simple-react-ui-kit'

import styles from './styles.module.sass'

export const PlacesListItemLoader: React.FC = () => (
    <article className={styles.placesListItem}>
        <div className={styles.photoSection}>
            <Skeleton style={{ height: '100%', width: '100%' }} />
        </div>
    </article>
)
