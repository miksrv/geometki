import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import dynamic from 'next/dynamic'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel } from '@/api'
import { openAuthDialog } from '@/app/applicationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'

import { CommentListItem } from './CommentListItem'

import styles from './styles.module.sass'

// Signed-in users only: the cached page of a guest does not load the form and its form library
const CommentForm = dynamic(() => import('./CommentForm').then((m) => ({ default: m.CommentForm })))

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

    const placeholder = t('review-placeholder', { defaultValue: 'Как добраться, когда лучше ехать, что посмотреть…' })

    return (
        <section className={styles.commentList}>
            {!!comments?.length && <div className={styles.items}>{renderComments()}</div>}

            {appAuth.isAuth ? (
                <div
                    ref={formRef}
                    className={styles.formSection}
                >
                    <CommentForm
                        placeId={placeId}
                        replyTo={replyTo}
                        isAuth={appAuth.isAuth}
                        user={appAuth.user}
                        placeholder={placeholder}
                        onCommentAdded={() => setReplyTo(undefined)}
                        onCancelReply={() => setReplyTo(undefined)}
                    />
                </div>
            ) : (
                // A guest sees the same field: a tap on it opens the sign-in dialog
                <button
                    type={'button'}
                    className={styles.guestField}
                    onClick={handleLoginClick}
                >
                    <span
                        className={styles.guestAvatar}
                        aria-hidden={true}
                    />
                    <span className={styles.guestInput}>{placeholder}</span>
                </button>
            )}

            {!comments?.length && (
                <p className={styles.empty}>
                    {t('reviews-empty', {
                        defaultValue: 'Отзывов пока нет. Первый отзыв поможет следующим путешественникам.'
                    })}
                </p>
            )}
        </section>
    )
}
