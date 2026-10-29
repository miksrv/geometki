import React, { useEffect, useState } from 'react'
import { TFunction } from 'i18next'
import { Button, cn } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { UserAvatar } from '@/components/shared'
import useClientOnly from '@/hooks/useClientOnly'
import { formatDate, timeAgo } from '@/utils/helpers'

import styles from './styles.module.sass'

type MarkdownComponent = typeof import('react-markdown').default

/**
 * A comment's text: as typed (line breaks kept) in the server HTML and until the markdown parser
 * has loaded after the page, then as markdown. The parser is not part of the page's first load:
 * the comments are far below the picture and the text
 */
const CommentText: React.FC<{ content: string }> = ({ content }) => {
    const [Markdown, setMarkdown] = useState<MarkdownComponent>()

    useEffect(() => {
        let active = true

        void import('react-markdown').then((module) => {
            if (active) {
                setMarkdown(() => module.default)
            }
        })

        return () => {
            active = false
        }
    }, [])

    return Markdown ? <Markdown>{content}</Markdown> : <p className={styles.plainText}>{content}</p>
}

interface CommentListItemProps {
    t: TFunction
    comment: ApiModel.Comment
    isAuth?: boolean
    isAnswer?: boolean
    isReplying?: boolean
    onAnswerClick?: (replyTo?: { id: string; name: string }) => void
}

export const CommentListItem: React.FC<CommentListItemProps> = ({
    t,
    comment,
    isAuth,
    isAnswer,
    isReplying,
    onAnswerClick
}) => {
    const { i18n } = useTranslation()
    // The page HTML is cached for days: it carries the date, the browser turns it into "3 days ago"
    const isClient = useClientOnly()

    const handleReplyClick = () => {
        onAnswerClick?.(isReplying ? undefined : { id: comment.id, name: comment.author.name })
    }

    return (
        <div className={cn(styles.commentItem, isAnswer && styles.answer)}>
            <div className={styles.block}>
                <UserAvatar
                    size={'medium'}
                    user={comment.author}
                />
                <div className={styles.content}>
                    <div className={styles.user}>
                        <Link
                            href={`/users/${comment.author.id}`}
                            title={comment.author.name}
                        >
                            {comment.author.name}
                        </Link>
                    </div>
                    <CommentText content={comment.content} />
                    <div
                        className={styles.info}
                        suppressHydrationWarning={true}
                    >
                        {isClient
                            ? timeAgo(comment.created?.date, undefined, i18n.language)
                            : formatDate(comment.created?.date, 'D MMMM YYYY')}

                        {isAuth && (
                            <Button
                                size={'small'}
                                mode={'link'}
                                className={cn(styles.answerButton, isReplying && styles.answerButtonActive)}
                                onClick={handleReplyClick}
                            >
                                {isReplying ? t('comment-answer-cancel') : t('comment-answer')}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
