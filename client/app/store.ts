import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux'

import { createWrapper, HYDRATE } from 'next-redux-wrapper'
import { combineReducers, configureStore, UnknownAction } from '@reduxjs/toolkit'

import { API } from '@/api/api'
import { APIPastvu } from '@/api/apiPastvu'
import { sanitizeForSerialization } from '@/utils/sanitizeState'

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

        // Merge auth state: prefer client-side user data, but update token/session from server if present
        const mergedAuth = (() => {
            const clientAuth = state?.auth
            const serverAuth = payload.auth

            // If server has auth data (token or isAuth), merge it with client state
            if (serverAuth?.token || serverAuth?.isAuth) {
                return {
                    ...clientAuth,
                    ...serverAuth,
                    // Preserve user from client state if server doesn't have it
                    user: serverAuth?.user ?? clientAuth?.user
                }
            }

            // Otherwise keep client auth state
            return clientAuth ?? combinedReducer(undefined, { type: '' }).auth
        })()

        return {
            ...state, // old client state

            // application can be hydrated
            application:
                payload.application ?? state?.application ?? combinedReducer(undefined, { type: '' }).application,

            // notification can be hydrated
            notification:
                payload.notification ?? state?.notification ?? combinedReducer(undefined, { type: '' }).notification,

            // Merged auth state preserving user data
            auth: mergedAuth,

            [API.reducerPath]: {
                ...state?.[API.reducerPath],
                ...payload[API.reducerPath],
                queries: {
                    ...state?.[API.reducerPath]?.queries,
                    ...payload[API.reducerPath]?.queries
                },
                provided: {
                    ...state?.[API.reducerPath]?.provided,
                    ...payload[API.reducerPath]?.provided
                }
            },
            [APIPastvu.reducerPath]: {
                ...state?.[APIPastvu.reducerPath],
                ...payload[APIPastvu.reducerPath],
                queries: {
                    ...state?.[APIPastvu.reducerPath]?.queries,
                    ...payload[APIPastvu.reducerPath]?.queries
                },
                provided: {
                    ...state?.[APIPastvu.reducerPath]?.provided,
                    ...payload[APIPastvu.reducerPath]?.provided
                }
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

export const wrapper = createWrapper<AppStore>(makeStore, {
    debug: false,
    serializeState: (state) => sanitizeForSerialization(state)
})
