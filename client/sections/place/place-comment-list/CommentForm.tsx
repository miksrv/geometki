import React, { useState } from 'react'
import { Button, Message, TextArea } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel } from '@/api'
import { UserAvatar } from '@/components/shared'
import { getErrorMessage } from '@/utils/api'

import styles from './styles.module.sass'

interface CommentFormProps {
    placeId?: string
    replyTo?: { id: string; name: string }
    isAuth?: boolean
    user?: ApiModel.User
    onCommentAdded?: () => void
    onCancelReply?: () => void
}

export const CommentForm: React.FC<CommentFormProps> = ({
    placeId,
    replyTo,
    isAuth,
    user,
    onCommentAdded,
    onCancelReply
}) => {
    const { t } = useTranslation()

    const [comment, setComment] = useState<string | undefined>()

    const [submit, { isLoading, error }] = API.useCommentsPostMutation()

    const handleKeyPress = async (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && event.ctrlKey && comment && comment.length > 1) {
            event.preventDefault()
            await handleSubmit()
        }
    }

    const handleSubmit = async () => {
        await submit({
            answerId: replyTo?.id,
            comment,
            placeId
        })

        setComment('')
        onCommentAdded?.()
    }

    const errorMessage = getErrorMessage(error)

    return isAuth ? (
        <div className={styles.commentForm}>
            {errorMessage && (
                <Message
                    type={'error'}
                    style={{ marginBottom: 8 }}
                >
                    {errorMessage}
                </Message>
            )}

            {replyTo && (
                <div className={styles.replyingTo}>
                    <span>
                        {t('comment-replying-to')} <strong>{replyTo.name}</strong>
                    </span>
                    <Button
                        size={'small'}
                        mode={'link'}
                        icon={'Close'}
                        className={styles.replyingToCancel}
                        tooltip={t('comment-reply-cancel', { defaultValue: 'Отменить ответ' })}
                        onClick={onCancelReply}
                    />
                </div>
            )}

            <div className={styles.commentFormRow}>
                {user && (
                    <UserAvatar
                        className={styles.userAvatar}
                        user={user}
                        size={'medium'}
                    />
                )}

                <TextArea
                    key={replyTo?.id ?? 'root'}
                    autoFocus={!!replyTo}
                    autoResize={true}
                    rows={1}
                    className={styles.textarea}
                    value={comment}
                    disabled={isLoading}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder={t('write-comment')}
                />

                <Button
                    icon={'KeyboardRight'}
                    mode={'secondary'}
                    className={styles.submitButton}
                    tooltip={t('comment-submit', { defaultValue: 'Отправить отзыв' })}
                    loading={isLoading}
                    disabled={isLoading || !comment}
                    onClick={handleSubmit}
                />
            </div>
        </div>
    ) : null
}
