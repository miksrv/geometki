import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, cn } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel } from '@/api'
import { openAuthDialog } from '@/app/applicationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'

import { CommentForm } from './CommentForm'
import { CommentListItem } from './CommentListItem'

import styles from './styles.module.sass'

interface CommentListProps {
    placeId?: string
}

export const CommentList: React.FC<CommentListProps> = ({ placeId }) => {
    const { t } = useTranslation()

    const dispatch = useAppDispatch()
    const formRef = useRef<HTMLDivElement>(null)

    const appAuth = useAppSelector((state) => state.auth)

    const [replyTo, setReplyTo] = useState<{ id: string; name: string } | undefined>()

    const { data } = API.useCommentsGetListQuery({ place: placeId }, { skip: !placeId })
    const comments = data?.items

    const handleLoginClick = (event: React.MouseEvent) => {
        event.preventDefault()
        dispatch(openAuthDialog())
    }

    const handleAnswerClick = (reply?: { id: string; name: string }) => {
        setReplyTo(reply)
    }

    useEffect(() => {
        if (replyTo) {
            formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
    }, [replyTo])

    const commentsByParent = useMemo(() => {
        const index: Record<string, ApiModel.Comment[]> = { root: [] }

        comments?.forEach((item) => {
            const key = item.answerId || 'root'
            ;(index[key] ??= []).push(item)
        })

        return index
    }, [comments])

    const renderComments = useCallback(
        (answerId?: string) =>
            (commentsByParent[answerId ?? 'root'] ?? []).map((item) => (
                <React.Fragment key={item.id}>
                    <CommentListItem
                        t={t}
                        isAuth={appAuth.isAuth}
                        isAnswer={!!answerId}
                        isReplying={replyTo?.id === item.id}
                        comment={item}
                        onAnswerClick={handleAnswerClick}
                    />

                    {renderComments(item.id)}
                </React.Fragment>
            )),
        [commentsByParent, t, appAuth.isAuth, replyTo]
    )

    return (
        <section className={styles.commentList}>
            {!comments?.length && (
                <div className={styles.empty}>
                    {t('comments-empty', { defaultValue: 'Пока никто не оставил комментарий. Ваш будет первым.' })}
                </div>
            )}
            {!!comments?.length && renderComments()}

            {appAuth.isAuth && (
                <div
                    ref={formRef}
                    className={styles.formSection}
                >
                    <CommentForm
                        placeId={placeId}
                        replyTo={replyTo}
                        isAuth={appAuth.isAuth}
                        user={appAuth.user}
                        onCommentAdded={() => setReplyTo(undefined)}
                        onCancelReply={() => setReplyTo(undefined)}
                    />
                </div>
            )}

            {!appAuth.isAuth && (
                <div className={cn(styles.loginContainer, !!comments?.length && styles.topBorder)}>
                    <div>{t('login-to-write-comment')}</div>
                    <div className={styles.loginAction}>
                        <Button
                            mode={'outline'}
                            label={t('sign-in')}
                            onClick={handleLoginClick}
                        />
                    </div>
                </div>
            )}
        </section>
    )
}
