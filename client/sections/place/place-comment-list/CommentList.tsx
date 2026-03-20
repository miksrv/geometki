import React, { useState } from 'react'
import { Button, cn } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next'

import { ApiModel, useAppDispatch, useAppSelector } from '@/api'
import { openAuthDialog } from '@/api/applicationSlice'

import { CommentForm } from './CommentForm'
import { CommentListItem } from './CommentListItem'

import styles from './styles.module.sass'

interface CommentListProps {
    placeId?: string
    comments?: ApiModel.Comment[]
    loading?: boolean
}

export const CommentList: React.FC<CommentListProps> = ({ placeId, comments }) => {
    const { t } = useTranslation()

    const dispatch = useAppDispatch()

    const appAuth = useAppSelector((state) => state.auth)

    const [answerFormId, setAnswerFormId] = useState<string | undefined>()

    const handleLoginClick = (event: React.MouseEvent) => {
        event.preventDefault()
        dispatch(openAuthDialog())
    }

    const renderComments = (comments: ApiModel.Comment[], answerId?: string) =>
        comments
            .filter((item) => (!answerId ? !item.answerId : item.answerId === answerId))
            .map((item) => (
                <React.Fragment key={item.id}>
                    <CommentListItem
                        t={t}
                        placeId={placeId}
                        isAuth={appAuth.isAuth}
                        isAnswer={!!answerId}
                        comment={item}
                        formAnswerId={answerFormId}
                        onAnswerClick={setAnswerFormId}
                    />

                    {renderComments(comments, item.id)}
                </React.Fragment>
            ))

    return (
        <section className={styles.commentList}>
            {!!comments?.length && renderComments(comments)}

            {appAuth.isAuth && (
                <div className={styles.formSection}>
                    <CommentForm
                        placeId={placeId}
                        isAuth={appAuth.isAuth}
                        user={appAuth.user}
                    />
                </div>
            )}

            {!appAuth.isAuth && (
                <div className={cn(styles.loginContainer, !!comments?.length && styles.topBorder)}>
                    <div>{t('login-to-write-comment')}</div>
                    <Button
                        className={styles.loginButton}
                        mode={'outline'}
                        label={t('sign-in')}
                        onClick={handleLoginClick}
                    />
                </div>
            )}
        </section>
    )
}
