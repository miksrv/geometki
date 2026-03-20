import { deleteCookie, setCookie } from 'cookies-next'

import { createSlice, PayloadAction } from '@reduxjs/toolkit'

import { ApiModel, ApiType } from '@/api'
import { LOCAL_STORAGE } from '@/config/constants'
import * as LocalStorage from '@/utils/localstorage'

type AuthStateProps = {
    isAuth?: boolean
    token?: string
    session?: string
    user?: ApiModel.User
}

export const getStorageToken = (): string =>
    typeof window !== 'undefined' ? LocalStorage.getItem(LOCAL_STORAGE.AUTH_TOKEN as 'AUTH_TOKEN') : ''

export const getStorageSession = (): string | undefined =>
    typeof window !== 'undefined' ? LocalStorage.getItem(LOCAL_STORAGE.AUTH_SESSION as 'AUTH_SESSION') : ''

const authSlice = createSlice({
    initialState: {
        session: getStorageSession(),
        token: getStorageToken()
    } as AuthStateProps,
    name: 'auth',
    reducers: {
        login: (state, { payload }: PayloadAction<ApiType.Auth.LoginResponse | undefined>) => {
            state.token = payload?.token ?? ''
            state.session = payload?.session ?? ''
            state.user = payload?.user ?? undefined
            state.isAuth = payload?.auth ?? false

            if (payload?.auth && !!payload.token) {
                void setCookie(LOCAL_STORAGE.AUTH_TOKEN, payload.token)

                LocalStorage.setItem(LOCAL_STORAGE.AUTH_TOKEN as 'AUTH_TOKEN', payload.token)
            } else {
                void deleteCookie(LOCAL_STORAGE.AUTH_TOKEN)
                LocalStorage.removeItem(LOCAL_STORAGE.AUTH_TOKEN as 'AUTH_TOKEN')
            }
        },
        logout: (state) => {
            state.token = undefined
            state.user = undefined
            state.isAuth = false

            void deleteCookie(LOCAL_STORAGE.AUTH_TOKEN)
            LocalStorage.removeItem(LOCAL_STORAGE.AUTH_TOKEN as 'AUTH_TOKEN')
        },
        saveSession: (state, { payload }: PayloadAction<string>) => {
            state.session = payload
        }
    }
})

export const { login, logout, saveSession } = authSlice.actions

export default authSlice.reducer
