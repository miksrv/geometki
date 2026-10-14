import { HYDRATE } from 'next-redux-wrapper'

import { addNotification } from './notificationSlice'
import { makeStore } from './store'

const hydrate = (store: ReturnType<typeof makeStore>, list: Array<{ id: string; message: string; type: 'error' }>) =>
    store.dispatch({ payload: { ...store.getState(), notification: { list } }, type: HYDRATE })

describe('store HYDRATE: notifications', () => {
    it('keeps the toasts of the client on navigation', () => {
        const store = makeStore()

        store.dispatch(addNotification({ id: 'saved', message: 'Saved', type: 'success' }))
        hydrate(store, [])

        expect(store.getState().notification.list.map(({ id }) => id)).toStrictEqual(['saved'])
    })

    it('adds the toasts of the server (an API error in getServerSideProps) once', () => {
        const store = makeStore()

        store.dispatch(addNotification({ id: 'saved', message: 'Saved', type: 'success' }))
        hydrate(store, [{ id: 'api-error:Not found', message: 'Not found', type: 'error' }])
        hydrate(store, [{ id: 'api-error:Not found', message: 'Not found', type: 'error' }])

        expect(store.getState().notification.list.map(({ id }) => id)).toStrictEqual(['saved', 'api-error:Not found'])
    })
})
