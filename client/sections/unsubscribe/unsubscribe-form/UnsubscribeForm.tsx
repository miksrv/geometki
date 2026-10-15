import React, { useEffect } from 'react'
import { Button, Container, Message, Spinner } from 'simple-react-ui-kit'

import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiType } from '@/api'
import { getErrorMessage } from '@/utils/api'

/**
 * The page behind the unsubscribe link of every notification email
 * (`/unsubscribe?token=…`). Opening it changes nothing (mail clients open
 * links to scan them); the user confirms with a button: the emails of the
 * link's scope, or all emails.
 */
export const UnsubscribeForm: React.FC = () => {
    const { t } = useTranslation()
    const router = useRouter()

    const token = typeof router.query.token === 'string' ? router.query.token : undefined
    // Links in emails sent before tokens carry the email id
    const mail = typeof router.query.mail === 'string' ? router.query.mail : undefined

    const {
        data: status,
        error: statusError,
        isLoading
    } = API.useMailGetUnsubscribeQuery({ mail, token }, { skip: !token && !mail })

    const [unsubscribe, { data: result, error: unsubscribeError, isLoading: isUnsubscribing, reset }] =
        API.useMailPostUnsubscribeMutation()

    // Another link opened in the same tab starts over
    useEffect(() => {
        reset()
    }, [token, mail])

    useEffect(() => {
        if (router.isReady && !token && !mail) {
            void router.push('/')
        }
    }, [router.isReady])

    const scopeText = (scope: ApiType.Mail.UnsubscribeScope) => t(`unsubscribe-scope_${scope}`)

    const handleUnsubscribe = (all: boolean) => {
        if (status?.token) {
            void unsubscribe({ scope: all ? 'all' : undefined, token: status.token })
        }
    }

    const error = statusError ?? unsubscribeError

    return (
        <div className={'centerPageContainer'}>
            <div className={'wrapper'}>
                <Container>
                    <h1 className={'header'}>{t('unsubscribe-from-email-notifications')}</h1>

                    {error && (
                        <Message
                            type={'error'}
                            title={t('error')}
                        >
                            {getErrorMessage(error)}
                        </Message>
                    )}

                    {isLoading && (
                        <div className={'loaderWrapper'}>
                            <Spinner />
                        </div>
                    )}

                    {result && (
                        <Message type={'success'}>
                            {result.scope === 'all'
                                ? t('unsubscribe-done-all')
                                : t('unsubscribe-done', { scope: scopeText(result.scope) })}
                        </Message>
                    )}

                    {status && !result && !status.subscribed && (
                        <Message type={'info'}>
                            {status.scope === 'all'
                                ? t('unsubscribe-already-all')
                                : t('unsubscribe-already', { scope: scopeText(status.scope) })}
                        </Message>
                    )}

                    {status && !result && status.subscribed && (
                        <>
                            <p className={'description'}>
                                {status.scope === 'all'
                                    ? t('unsubscribe-question-all')
                                    : t('unsubscribe-question', { scope: scopeText(status.scope) })}
                            </p>
                            <div className={'actions'}>
                                <Button
                                    size={'medium'}
                                    mode={'primary'}
                                    disabled={isUnsubscribing}
                                    label={t('unsubscribe-button')}
                                    onClick={() => handleUnsubscribe(false)}
                                />
                                {status.scope !== 'all' && (
                                    <Button
                                        size={'medium'}
                                        mode={'secondary'}
                                        disabled={isUnsubscribing}
                                        label={t('unsubscribe-all-button')}
                                        onClick={() => handleUnsubscribe(true)}
                                    />
                                )}
                            </div>
                        </>
                    )}

                    {(status || error) && !isLoading && (
                        <div className={'actions'}>
                            <Button
                                link={'/users/settings'}
                                size={'medium'}
                                mode={'link'}
                                label={t('unsubscribe-settings-link')}
                            />
                            <Button
                                link={'/'}
                                size={'medium'}
                                mode={'link'}
                                label={t('go-to-home-page')}
                            />
                        </div>
                    )}
                </Container>
            </div>
        </div>
    )
}
