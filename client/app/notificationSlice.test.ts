import { ApiModel } from '@/api'

import notificationReducer, {
    deleteAllNotifications,
    deleteNotification,
    setReadNotification
} from './notificationSlice'

// addNotification is internal to the slice — access it via the reducer by constructing the action manually
const addNotification = (notification: ApiModel.Notification) => ({
    payload: notification,
    type: 'snackbar/addNotification'
})

describe('notificationSlice', () => {
    const initialState = {
        list: [] as ApiModel.Notification[]
    }

    const notifA: ApiModel.Notification = { id: 'a', message: 'First notification', type: 'success' }
    const notifB: ApiModel.Notification = { id: 'b', message: 'Second notification', type: 'error' }

    describe('initial state', () => {
        it('has an empty list', () => {
            const state = notificationReducer(undefined, { type: '@@INIT' })

            expect(state.list).toStrictEqual([])
        })
    })

    describe('addNotification', () => {
        it('adds a notification to the list', () => {
            const state = notificationReducer({ ...initialState }, addNotification(notifA))

            expect(state.list).toHaveLength(1)
            expect(state.list[0]).toMatchObject(notifA)
        })

        it('does not add a duplicate notification with the same id', () => {
            const stateWithOne = notificationReducer({ ...initialState }, addNotification(notifA))
            const stateAfterDuplicate = notificationReducer(stateWithOne, addNotification(notifA))

            expect(stateAfterDuplicate.list).toHaveLength(1)
        })

        it('adds multiple distinct notifications', () => {
            const state1 = notificationReducer({ ...initialState }, addNotification(notifA))
            const state2 = notificationReducer(state1, addNotification(notifB))

            expect(state2.list).toHaveLength(2)
        })
    })

    describe('deleteNotification', () => {
        it('removes a notification by id', () => {
            const stateWithTwo = {
                ...initialState,
                list: [notifA, notifB]
            }

            const state = notificationReducer(stateWithTwo, deleteNotification('a'))

            expect(state.list).toHaveLength(1)
            expect(state.list[0].id).toBe('b')
        })

        it('does nothing if id is not found', () => {
            const stateWithOne = { ...initialState, list: [notifA] }
            const state = notificationReducer(stateWithOne, deleteNotification('nonexistent'))

            expect(state.list).toHaveLength(1)
        })
    })

    describe('deleteAllNotifications', () => {
        it('clears the entire list', () => {
            const stateWithItems = { ...initialState, list: [notifA, notifB] }
            const state = notificationReducer(stateWithItems, deleteAllNotifications())

            expect(state.list).toStrictEqual([])
        })
    })

    describe('setReadNotification', () => {
        it('marks a notification as read', () => {
            const stateWithOne = { ...initialState, list: [{ ...notifA, read: false }] }
            const state = notificationReducer(stateWithOne, setReadNotification('a'))

            const updated = state.list.find(({ id }) => id === 'a')

            expect(updated?.read).toBe(true)
        })

        it('does nothing if id is not found', () => {
            const stateWithOne = { ...initialState, list: [notifA] }
            const state = notificationReducer(stateWithOne, setReadNotification('nonexistent'))

            expect(state.list).toHaveLength(1)
        })
    })
})
