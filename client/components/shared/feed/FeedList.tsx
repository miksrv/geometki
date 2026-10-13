import React, { useId } from 'react'
import { cn } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { dayHeading, groupStoriesByDay, siteToday } from '@/utils/feed'

import { FeedDensity, FeedStory } from './FeedStory'
import { FeedStoryLoader } from './FeedStoryLoader'

import styles from './styles.module.sass'

export interface FeedListProps {
    stories?: ApiModel.FeedStory[]
    loading?: boolean
    density?: FeedDensity
    /** The place history: stories without the place attached */
    hidePlace?: boolean
    /** Split the stories by day under date headings (the feed page, the profile) */
    groupByDay?: boolean
    /** Line shown instead of the list when there are no stories */
    emptyText?: string
    /** Under the list: a "show more" button */
    footer?: React.ReactNode
    className?: string
}

/**
 * The activity feed: stories in order, under day headings when `groupByDay`; skeletons
 * while loading; one line of text when empty (DESIGN.md → empty states).
 */
export const FeedList: React.FC<FeedListProps> = ({
    stories,
    loading,
    density = 'full',
    hidePlace,
    groupByDay,
    emptyText,
    footer,
    className
}) => {
    const { t, i18n } = useTranslation()
    const idPrefix = `feed-day${useId().replace(/:/g, '')}`

    if (!stories?.length && !loading) {
        return (
            <p className={styles.empty}>
                {emptyText ?? t('nothing-here-yet', { defaultValue: 'Тут пока ничего нет' })}
            </p>
        )
    }

    const renderStories = (items: ApiModel.FeedStory[]) =>
        items.map((story) => (
            <FeedStory
                key={story.id}
                story={story}
                density={density}
                hidePlace={hidePlace}
            />
        ))

    const today = siteToday()

    return (
        <div className={cn(styles.feed, className)}>
            {groupByDay
                ? groupStoriesByDay(stories).map((day, index) => {
                      const heading = dayHeading(day.date, today, i18n.language)
                      // A story that grew while loaded can bring its day back further down
                      const id = `${idPrefix}-${day.date}-${index}`

                      return (
                          <section
                              key={id}
                              className={styles.day}
                              aria-labelledby={id}
                          >
                              <h2
                                  id={id}
                                  className={styles.dayHeading}
                              >
                                  {'key' in heading ? t(`feed-${heading.key}`) : heading.text}
                              </h2>
                              {renderStories(day.stories)}
                          </section>
                      )
                  })
                : renderStories(stories ?? [])}

            {loading && (
                <>
                    <FeedStoryLoader />
                    <FeedStoryLoader />
                </>
            )}

            {footer && <div className={styles.footer}>{footer}</div>}
        </div>
    )
}
