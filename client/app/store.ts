import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux'

import { createWrapper, HYDRATE } from 'next-redux-wrapper'
import { combineReducers, configureStore, UnknownAction } from '@reduxjs/toolkit'

import { API } from '@/api/api'
import { APIPastvu } from '@/api/apiPastvu'

import applicationSlice from './applicationSlice'
import authSlice from './authSlice'
import notificationSlice from './notificationSlice'

// 1. Combine all reducers
const combinedReducer = combineReducers({
    application: applicationSlice,
    auth: authSlice,
    notification: notificationSlice,
    [API.reducerPath]: API.reducer,
    [APIPastvu.reducerPath]: APIPastvu.reducer
})

// 2. Process HYDRATE separately
type RootReducerState = ReturnType<typeof combinedReducer>

const rootReducer: (state: RootReducerState | undefined, action: UnknownAction) => RootReducerState = (
    state,
    action
) => {
    if (action.type === HYDRATE) {
        const payload = action.payload as RootReducerState

        return {
            ...state, // old client state

            // application can be hydrated
            application:
                payload.application ?? state?.application ?? combinedReducer(undefined, { type: '' }).application,

            // notification can be hydrated
            notification:
                payload.notification ?? state?.notification ?? combinedReducer(undefined, { type: '' }).notification,

            // DO NOT touch auth if there is nothing in payload
            auth:
                payload.auth?.token || payload.auth?.isAuth
                    ? payload.auth
                    : (state?.auth ?? combinedReducer(undefined, { type: '' }).auth),

            [API.reducerPath]: {
                ...state?.[API.reducerPath],
                ...payload[API.reducerPath]
            },
            [APIPastvu.reducerPath]: {
                ...state?.[APIPastvu.reducerPath],
                ...payload[APIPastvu.reducerPath]
            }
        }
    }

    return combinedReducer(state, action)
}

// 3. Configure the store
export const makeStore = () =>
    configureStore({
        reducer: rootReducer,
        devTools: process.env.NODE_ENV !== 'production',
        middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(API.middleware, APIPastvu.middleware)
    })

export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']

export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector

export const wrapper = createWrapper<AppStore>(makeStore, { debug: false })
