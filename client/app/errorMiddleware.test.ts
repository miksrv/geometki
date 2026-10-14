import { configureStore } from '@reduxjs/toolkit'

import { errorMiddleware } from './errorMiddleware'
import notificationReducer from './notificationSlice'

jest.mock('next-i18next/pages', () => ({
    i18n: {
        t: (key: string, options?: { defaultValue?: string }) =>
            key === 'api-error-generic' ? 'Generic server error' : (options?.defaultValue ?? key)
    }
}))

const REJECTED_TYPE = 'api/executeQuery/rejected'

const rejectedWithValue = (payload: unknown, type = REJECTED_TYPE, endpointName = 'placesGetItem') => ({
    error: { message: 'Rejected' },
    meta: {
        arg: { endpointName, type: 'query' },
        rejectedWithValue: true,
        requestId: 'req-1',
        requestStatus: 'rejected' as const
    },
    payload,
    type
})

const createStore = () =>
    configureStore({
        middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(errorMiddleware),
        reducer: { notification: notificationReducer }
    })

const messagesOf = (store: ReturnType<typeof createStore>) =>
    store.getState().notification.list.map(({ message }) => message)

describe('errorMiddleware', () => {
    it('ignores the failures of the external services', () => {
        const store = createStore()

        store.dispatch(
            rejectedWithValue({ data: '<html>502</html>', status: 502 }, 'APIWaymarkedTrails/executeQuery/rejected')
        )
        store.dispatch(
            rejectedWithValue({ error: 'SyntaxError', status: 'PARSING_ERROR' }, 'APIWayback/executeQuery/rejected')
        )

        expect(messagesOf(store)).toStrictEqual([])
    })

    it('shows the message from the API error envelope', () => {
        const store = createStore()

        store.dispatch(rejectedWithValue({ data: { messages: { error: 'Collection not found' } }, status: 404 }))

        expect(messagesOf(store)).toStrictEqual(['Collection not found'])
    })

    it('shows a string payload as is', () => {
        const store = createStore()

        store.dispatch(rejectedWithValue('Already extracted'))

        expect(messagesOf(store)).toStrictEqual(['Already extracted'])
    })

    it('never shows a raw non-JSON body, uses the generic message for 5xx', () => {
        const store = createStore()
        const rawBody = '<br /><b>Fatal error</b>: Type of App\\Controllers\\Collections::$model in /srv/app.php'

        store.dispatch(
            rejectedWithValue({ data: rawBody, error: 'SyntaxError', originalStatus: 500, status: 'PARSING_ERROR' })
        )

        expect(messagesOf(store)).toStrictEqual(['Generic server error'])
    })

    it('uses the generic message for a 5xx without an envelope', () => {
        const store = createStore()

        store.dispatch(rejectedWithValue({ data: { title: 'ErrorException', message: 'secret' }, status: 502 }))

        expect(messagesOf(store)).toStrictEqual(['Generic server error'])
    })

    it('stays silent for a 4xx without an envelope message (form validation errors)', () => {
        const store = createStore()

        store.dispatch(rejectedWithValue({ data: { messages: { title: 'Required' } }, status: 400 }))

        expect(messagesOf(store)).toStrictEqual([])
    })

    it('ignores actions that were not rejected with a value', () => {
        const store = createStore()

        store.dispatch({ ...rejectedWithValue('ignored'), meta: { rejectedWithValue: false } })

        expect(messagesOf(store)).toStrictEqual([])
    })

    it('shows the same error once, however many requests fail with it', () => {
        const store = createStore()

        store.dispatch(rejectedWithValue({ data: { messages: { error: 'Temporary' } }, status: 500 }))
        store.dispatch(rejectedWithValue({ data: { messages: { error: 'Temporary' } }, status: 500 }))
        store.dispatch(rejectedWithValue({ data: { messages: { error: 'Other' } }, status: 400 }))

        expect(messagesOf(store)).toStrictEqual(['Temporary', 'Other'])
        expect(store.getState().notification.list[0].revision).toBe(1)
    })

    it('stays silent for background requests: notification polling and marking read', () => {
        const store = createStore()

        store.dispatch(rejectedWithValue({ data: 'down', status: 503 }, REJECTED_TYPE, 'notificationsGetUpdates'))
        store.dispatch(
            rejectedWithValue({ data: 'down', status: 503 }, 'api/executeMutation/rejected', 'notificationsPatchRead')
        )

        expect(messagesOf(store)).toStrictEqual([])
    })
})
