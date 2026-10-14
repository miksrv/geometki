import React from 'react'
import { Skeleton } from 'simple-react-ui-kit'

import styles from './styles.module.sass'

/** Placeholder of a feed story while the feed loads */
export const FeedStoryLoader: React.FC = () => (
    <div
        className={styles.story}
        data-testid={'feed-story-loader'}
        aria-hidden={true}
    >
        <div className={styles.head}>
            <Skeleton className={styles.loaderAvatar} />
            <div className={styles.headline}>
                <Skeleton className={styles.loaderLine} />
                <Skeleton className={styles.loaderTime} />
            </div>
        </div>
        <Skeleton className={styles.loaderMedia} />
    </div>
)
