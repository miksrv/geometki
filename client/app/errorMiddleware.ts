import { i18n } from 'next-i18next/pages'
import { isRejectedWithValue, Middleware } from '@reduxjs/toolkit'

import { NotifyReplace } from './notificationSlice'

type ApiErrorPayload = {
    status?: number | string
    originalStatus?: number
    data?: unknown
}

// `API.reducerPath`, not imported: api.ts imports the store, which imports this middleware.
// Only the project's API has the error envelope and the user's actions behind its requests; the external
// services of the map layers (Pastvu, Wikipedia, Waymarked Trails, Wayback) fail silently
const API_ACTION_PREFIX = 'api/'

// Background requests the user did not ask for: polling notifications and marking them read.
// A failure there is retried on its own; a toast every 15 seconds while the API is down helps nobody
const SILENT_ENDPOINTS = new Set(['notificationsGetUpdates', 'notificationsPatchRead'])

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
 * RTK Query middleware that turns rejected requests of the project API into error notifications.
 *
 * Only two sources are ever displayed: a string payload (endpoints whose
 * `transformErrorResponse` already extracted the message) and the API error
 * envelope. Server-side failures without an envelope get a generic message.
 */
export const errorMiddleware: Middleware = (api) => (next) => (action) => {
    if (isRejectedWithValue(action) && action.type.startsWith(API_ACTION_PREFIX)) {
        const endpointName = (action.meta.arg as { endpointName?: string } | undefined)?.endpointName
        const payload = action.payload

        let errorMessage: string | undefined

        if (endpointName && SILENT_ENDPOINTS.has(endpointName)) {
            return next(action)
        }

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
            // Keyed by the text: the same error again restarts its toast instead of stacking a copy
            api.dispatch(
                NotifyReplace({
                    id: `api-error:${errorMessage}`,
                    message: errorMessage,
                    type: 'error'
                })
            )
        }
    }

    return next(action)
}
