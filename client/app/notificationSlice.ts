import { createSlice, PayloadAction } from '@reduxjs/toolkit'

import { ApiModel } from '@/api'

/**
 * A toast. `revision` grows with every NotifyReplace of the same id: the Snackbar keys the
 * toast by it, so a replaced toast plays its entrance again and restarts its timer.
 */
export type SnackbarNotification = ApiModel.Notification & { revision?: number }

type NotificationState = {
    list: SnackbarNotification[]
}

const notificationSlice = createSlice({
    initialState: {
        list: []
    } as NotificationState,
    name: 'snackbar',
    reducers: {
        addNotification: (state, { payload }: PayloadAction<ApiModel.Notification>) => {
            if ((payload.type || payload.message) && !state.list.some(({ id }) => id === payload.id)) {
                state.list.push(payload)
            }
        },
        deleteAllNotifications: (state) => {
            state.list = []
        },
        deleteNotification: (state, { payload }: PayloadAction<string>) => {
            state.list = state.list.filter(({ id }) => id !== payload)
        },
        replaceNotification: (state, { payload }: PayloadAction<ApiModel.Notification>) => {
            if (!payload.type && !payload.message) {
                return
            }

            const index = state.list.findIndex(({ id }) => id === payload.id)

            if (index === -1) {
                state.list.push({ ...payload, read: false })
            } else {
                state.list[index] = { ...payload, read: false, revision: (state.list[index].revision ?? 0) + 1 }
            }
        },
        setReadNotification: (state, { payload }: PayloadAction<string>) => {
            const notification = state.list.find(({ id }) => id === payload)

            if (notification) {
                notification.read = true
            }
        }
    }
})

export const { deleteAllNotifications, setReadNotification, deleteNotification, addNotification, replaceNotification } =
    notificationSlice.actions

/** Show a toast; a toast with the same id already on screen stays as it is */
export const Notify = addNotification

/** Show a toast, or replace the one with the same id (its text, type and timer) */
export const NotifyReplace = replaceNotification

export { notificationSlice }

export default notificationSlice.reducer
