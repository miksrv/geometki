import React from 'react'
import Markdown from 'react-markdown'
import { TFunction } from 'i18next'
import { Button, cn } from 'simple-react-ui-kit'

import Link from 'next/link'

import { ApiModel } from '@/api'
import { UserAvatar } from '@/components/shared'
import { timeAgo } from '@/utils/helpers'

import { CommentForm } from './CommentForm'

import styles from './styles.module.sass'

interface CommentListItemProps {
    t: TFunction
    placeId?: string
    comment: ApiModel.Comment
    isAuth?: boolean
    isAnswer?: boolean
    formAnswerId?: string
    onAnswerClick?: (id?: string) => void
}

export const CommentListItem: React.FC<CommentListItemProps> = ({
    t,
    placeId,
    comment,
    isAuth,
    isAnswer,
    formAnswerId,
    onAnswerClick
}) => (
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
                        title={''}
                    >
                        {comment.author.name}
                    </Link>
                </div>
                <Markdown>{comment.content}</Markdown>
                <div className={styles.info}>
                    {timeAgo(comment.created?.date)}

                    {isAuth && (
                        <Button
                            size={'small'}
                            mode={'link'}
                            className={styles.answerButton}
                            onClick={() => onAnswerClick?.(formAnswerId !== comment.id ? comment.id : undefined)}
                        >
                            {formAnswerId === comment.id ? t('comment-answer-cancel') : t('comment-answer')}
                        </Button>
                    )}
                </div>

                {formAnswerId === comment.id && (
                    <CommentForm
                        placeId={placeId}
                        answerId={comment.id}
                        isAuth={isAuth}
                        onCommentAdded={() => onAnswerClick?.(undefined)}
                    />
                )}
            </div>
        </div>
    </div>
)
