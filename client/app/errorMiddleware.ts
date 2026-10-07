import { i18n } from 'next-i18next/pages'
import { isRejectedWithValue, Middleware } from '@reduxjs/toolkit'

import { notificationSlice } from './notificationSlice'

type ApiErrorPayload = {
    status?: number | string
    originalStatus?: number
    data?: unknown
}

const NOTIFICATION_TTL_MS = 10_000

/**
 * Message from the documented API error envelope `{ messages: { error } }`.
 * Anything else (HTML error pages, plain text, proxy responses) is ignored —
 * the raw body is never shown to the user.
 */
const getEnvelopeMessage = (data: unknown): string | undefined => {
    if (!data || typeof data !== 'object') {
        return undefined
    }

    const message = (data as { messages?: { error?: unknown } }).messages?.error

    return typeof message === 'string' && message ? message : undefined
}

/**
 * True when the request failed on the server side (5xx or a body that is not
 * valid JSON) — the cases where there is no meaningful message to show, so a
 * generic one is used instead.
 */
const isServerFailure = ({ status, originalStatus }: ApiErrorPayload): boolean => {
    if (status === 'PARSING_ERROR') {
        return true
    }

    const code = typeof status === 'number' ? status : originalStatus

    return typeof code === 'number' && code >= 500
}

const getGenericServerErrorMessage = (): string =>
    i18n?.t('api-error-generic', { defaultValue: 'На сервере произошла ошибка, попробуйте ещё раз позже' }) ??
    'На сервере произошла ошибка, попробуйте ещё раз позже'

/**
 * RTK Query middleware that turns rejected API requests into error notifications.
 *
 * Only two sources are ever displayed: a string payload (endpoints whose
 * `transformErrorResponse` already extracted the message) and the API error
 * envelope. Server-side failures without an envelope get a generic message.
 */
export const errorMiddleware: Middleware = (api) => (next) => (action) => {
    if (isRejectedWithValue(action)) {
        const payload = action.payload

        let errorMessage: string | undefined

        if (typeof payload === 'string') {
            errorMessage = payload
        } else if (payload && typeof payload === 'object') {
            const apiPayload = payload as ApiErrorPayload

            errorMessage = getEnvelopeMessage(apiPayload.data)

            if (!errorMessage && isServerFailure(apiPayload)) {
                errorMessage = getGenericServerErrorMessage()
            }
        }

        if (errorMessage) {
            const notificationId = `api-error-${Date.now()}`

            api.dispatch(
                notificationSlice.actions.addNotification({
                    id: notificationId,
                    message: errorMessage,
                    type: 'error'
                })
            )

            setTimeout(() => {
                api.dispatch(notificationSlice.actions.deleteNotification(notificationId))
            }, NOTIFICATION_TTL_MS)
        }
    }

    return next(action)
}
