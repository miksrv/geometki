import { ApiModel } from '@/api'

import notificationReducer, {
    addNotification,
    deleteAllNotifications,
    deleteNotification,
    NotifyReplace,
    setReadNotification
} from './notificationSlice'

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

        it('keeps the toast in its place on screen', () => {
            const state = notificationReducer(
                { ...initialState, list: [{ ...notifA, read: false }, notifB] },
                setReadNotification('a')
            )

            expect(state.list.map(({ id }) => id)).toStrictEqual(['a', 'b'])
        })
    })

    describe('addNotification without content', () => {
        it('ignores a notification with neither a type nor a message', () => {
            const state = notificationReducer({ ...initialState }, addNotification({ id: 'empty' }))

            expect(state.list).toStrictEqual([])
        })
    })

    describe('NotifyReplace', () => {
        it('adds a new toast as unread', () => {
            const state = notificationReducer({ ...initialState }, NotifyReplace(notifA))

            expect(state.list).toStrictEqual([{ ...notifA, read: false }])
        })

        it('replaces the toast with the same id in place and bumps its revision', () => {
            const first = notificationReducer({ ...initialState, list: [notifA, notifB] }, NotifyReplace(notifA))
            const second = notificationReducer(first, NotifyReplace({ ...notifA, message: 'Updated' }))

            expect(second.list.map(({ id }) => id)).toStrictEqual(['a', 'b'])
            expect(second.list[0]).toMatchObject({ message: 'Updated', read: false, revision: 2 })
        })
    })
})
