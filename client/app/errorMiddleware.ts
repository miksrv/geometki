import { isRejectedWithValue, Middleware } from '@reduxjs/toolkit'

import { notificationSlice } from './notificationSlice'

/**
 * RTK Query middleware that catches API errors and displays notifications.
 * This prevents UI crashes when transformErrorResponse fails to handle null/undefined responses.
 */
export const errorMiddleware: Middleware = (api) => (next) => (action) => {
    if (isRejectedWithValue(action)) {
        const payload = action.payload

        // Extract error message from various response formats
        let errorMessage: string | undefined

        if (typeof payload === 'string') {
            errorMessage = payload
        } else if (payload && typeof payload === 'object') {
            const data = (payload as { data?: unknown }).data

            if (typeof data === 'string') {
                errorMessage = data
            } else if (data && typeof data === 'object') {
                const messages = (data as { messages?: { error?: string } }).messages
                errorMessage = messages?.error
            }
        }

        // Only show notification if we have a meaningful error message
        if (errorMessage) {
            const notificationId = `api-error-${Date.now()}`

            api.dispatch(
                notificationSlice.actions.addNotification({
                    id: notificationId,
                    message: errorMessage,
                    type: 'error'
                })
            )

            // Auto-remove notification after 10 seconds
            setTimeout(() => {
                api.dispatch(notificationSlice.actions.deleteNotification(notificationId))
            }, 10000)
        }
    }

    return next(action)
}
