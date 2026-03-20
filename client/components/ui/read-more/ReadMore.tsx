import React, { useState } from 'react'
import Markdown from 'react-markdown'
import { cn } from 'simple-react-ui-kit'

import { removeMarkdown, truncateText } from '@/utils/helpers'

import styles from './styles.module.sass'

export interface ReadMoreProps {
    className?: string
    children?: string
    charCount?: number
    showMoreText?: string
    showLessText?: string
}

export const ReadMore: React.FC<ReadMoreProps> = ({
    className,
    children,
    charCount = 300,
    showMoreText = 'Show more',
    showLessText = 'Show less'
}) => {
    const [readMore, setReadMore] = useState(false)

    const toggleReadMore = () => {
        setReadMore(!readMore)
    }

    const toggleButton = () =>
        children && children.length > charCount ? (
            <button
                onClick={toggleReadMore}
                className={styles.readMoreButton}
            >
                {readMore ? showLessText : showMoreText}
            </button>
        ) : (
            ''
        )

    return (
        <div className={cn(className, styles.readMore)}>
            {!readMore ? (
                <p>
                    {truncateText(removeMarkdown(children), charCount) +
                        (children && children.length > charCount ? '...' : '')}{' '}
                    {toggleButton()}
                </p>
            ) : (
                <>
                    <Markdown>{children}</Markdown>
                    {toggleButton()}
                </>
            )}
        </div>
    )
}
