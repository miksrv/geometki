import React from 'react'
import { cn, Skeleton } from 'simple-react-ui-kit'

import type { FeedDensity } from './FeedStory'

import styles from './styles.module.sass'

interface FeedStoryLoaderProps {
    /** As the stories it stands for: `compact` — no card and no media, a rule from the story above */
    density?: FeedDensity
}

/** Placeholder of a feed story while the feed loads, in the look of the stories around it */
export const FeedStoryLoader: React.FC<FeedStoryLoaderProps> = ({ density = 'full' }) => (
    <div
        className={cn(styles.story, density === 'compact' && styles.compact)}
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
        {density !== 'compact' && <Skeleton className={styles.loaderMedia} />}
    </div>
)
