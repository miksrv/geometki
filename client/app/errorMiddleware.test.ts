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

const rejectedWithValue = (payload: unknown) => ({
    error: { message: 'Rejected' },
    meta: { rejectedWithValue: true, requestId: 'req-1', requestStatus: 'rejected' as const },
    payload,
    type: REJECTED_TYPE
})

const createStore = () =>
    configureStore({
        middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(errorMiddleware),
        reducer: { notification: notificationReducer }
    })

const messagesOf = (store: ReturnType<typeof createStore>) =>
    store.getState().notification.list.map(({ message }) => message)

describe('errorMiddleware', () => {
    beforeEach(() => {
        jest.useFakeTimers()
    })

    afterEach(() => {
        jest.useRealTimers()
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

    it('removes the notification after the timeout', () => {
        const store = createStore()

        store.dispatch(rejectedWithValue({ data: { messages: { error: 'Temporary' } }, status: 500 }))
        expect(messagesOf(store)).toHaveLength(1)

        jest.advanceTimersByTime(10_000)

        expect(messagesOf(store)).toStrictEqual([])
    })
})
