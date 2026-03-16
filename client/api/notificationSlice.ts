import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit'

import { ApiModel } from '@/api'
import type { RootState } from '@/api/store'

type SnackbarStateProps = {
    list: ApiModel.Notification[]
    counter: number
}

export const Notify = createAsyncThunk(
    'snackbar/addNotification',
    async (notification: ApiModel.Notification, { dispatch, getState }) => {
        if (!notification.type && !notification.message) {
            return
        }

        dispatch(notificationSlice.actions.addNotification(notification))

        setTimeout(() => {
            const state = getState() as RootState
            const exists = state.snackbar.list.some(({ id }) => id === notification.id)

            if (exists) {
                dispatch(deleteNotification(notification.id))
            }
        }, 10000)

        return notification
    }
)

const notificationSlice = createSlice({
    initialState: {
        counter: 0,
        list: []
    } as SnackbarStateProps,
    name: 'snackbar',
    reducers: {
        addNotification: (state, { payload }: PayloadAction<ApiModel.Notification>) => {
            if (!state.list.find(({ id }) => id === payload.id)) {
                state.list = [...state.list, payload]
            }
        },
        deleteAllNotifications: (state) => {
            state.list = []
        },
        deleteNotification: (state, { payload }: PayloadAction<string>) => {
            state.list = state.list.filter(({ id }) => id !== payload)
        },
        setReadNotification: (state, { payload }: PayloadAction<string>) => {
            const notification = state.list.find(({ id }) => id === payload)

            if (notification) {
                state.list = [
                    ...(state.list.filter(({ id }) => id !== payload) || []),
                    {
                        ...notification,
                        read: true
                    }
                ]
            }
        },
        setUnreadCounter: (state, { payload }: PayloadAction<number>) => {
            state.counter = payload
        }
    }
})

export const { deleteAllNotifications, setReadNotification, deleteNotification, setUnreadCounter } =
    notificationSlice.actions

export default notificationSlice.reducer
