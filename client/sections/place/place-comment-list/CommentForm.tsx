import React, { useState } from 'react'
import { Button, Message, TextArea } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel } from '@/api'
import { UserAvatar } from '@/components/shared'
import { getErrorMessage } from '@/utils/api'

import styles from './styles.module.sass'

interface CommentFormProps {
    placeId?: string
    answerId?: string
    isAuth?: boolean
    user?: ApiModel.User
    onCommentAdded?: () => void
}

export const CommentForm: React.FC<CommentFormProps> = ({ placeId, answerId, isAuth, user, onCommentAdded }) => {
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
            answerId,
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

            {user && (
                <UserAvatar
                    className={styles.userAvatar}
                    user={user}
                    size={'medium'}
                />
            )}

            <TextArea
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
                loading={isLoading}
                disabled={isLoading || !comment}
                onClick={handleSubmit}
            />
        </div>
    ) : null
}
