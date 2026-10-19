import React from 'react'
import Markdown from 'react-markdown'
import { TFunction } from 'i18next'
import { Button, cn } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { UserAvatar } from '@/components/shared'
import useClientOnly from '@/hooks/useClientOnly'
import { formatDate, timeAgo } from '@/utils/helpers'

import styles from './styles.module.sass'

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
                    <Markdown>{comment.content}</Markdown>
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
