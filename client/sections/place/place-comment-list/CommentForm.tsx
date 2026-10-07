import React from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Button, Message, TextArea } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel } from '@/api'
import { UserAvatar } from '@/components/shared'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import { getErrorMessage } from '@/utils/api'

import styles from './styles.module.sass'

const ConfirmationDialog = dynamic(() => import('@/components/shared/confirmation-dialog/ConfirmationDialog'), {
    ssr: false
})

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

    const { control, handleSubmit, reset, watch } = useForm<{ comment: string }>({ defaultValues: { comment: '' } })

    const comment = watch('comment')

    const [submitComment, { isLoading, error }] = API.useCommentsPostMutation()

    // An unsent comment is lost on leaving the page, so it is guarded like any other form
    const { dialogProps: leaveDialogProps } = useUnsavedChangesGuard(!!comment.trim())

    const submit = handleSubmit(async (values) => {
        const result = await submitComment({
            answerId: replyTo?.id,
            comment: values.comment,
            placeId
        })

        if ('error' in result) {
            return
        }

        reset({ comment: '' })
        onCommentAdded?.()
    })

    const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && event.ctrlKey && comment.trim().length > 1) {
            event.preventDefault()
            void submit()
        }
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

                <Controller
                    name={'comment'}
                    control={control}
                    render={({ field }) => (
                        <TextArea
                            key={replyTo?.id ?? 'root'}
                            autoFocus={!!replyTo}
                            autoResize={true}
                            rows={1}
                            className={styles.textarea}
                            value={field.value}
                            disabled={isLoading}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            onKeyDown={handleKeyPress}
                            placeholder={t('write-comment')}
                        />
                    )}
                />

                <Button
                    icon={'KeyboardRight'}
                    mode={'secondary'}
                    className={styles.submitButton}
                    tooltip={t('comment-submit', { defaultValue: 'Отправить отзыв' })}
                    loading={isLoading}
                    disabled={isLoading || !comment.trim()}
                    onClick={() => void submit()}
                />
            </div>

            <ConfirmationDialog {...leaveDialogProps} />
        </div>
    ) : null
}
