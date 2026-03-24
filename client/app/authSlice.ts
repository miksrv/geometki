import { deleteCookie, getCookie, setCookie } from 'cookies-next'

import { createSlice, PayloadAction } from '@reduxjs/toolkit'

import { ApiModel, ApiType } from '@/api'
import { AUTH_COOKIES } from '@/config/constants'

type AuthStateProps = {
    isAuth?: boolean
    token?: string
    session?: string
    user?: ApiModel.User
}

export const getStorageToken = (): string =>
    (typeof window !== 'undefined' ? (getCookie(AUTH_COOKIES.TOKEN) as string) : '') ?? ''

export const getStorageSession = (): string | undefined =>
    (typeof window !== 'undefined' ? (getCookie(AUTH_COOKIES.SESSION) as string) : '') ?? ''

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
                void setCookie(AUTH_COOKIES.TOKEN, payload.token)
                void setCookie(AUTH_COOKIES.SESSION, payload?.session ?? '')
            } else {
                void deleteCookie(AUTH_COOKIES.TOKEN)
                void deleteCookie(AUTH_COOKIES.SESSION)
            }
        },
        logout: (state) => {
            state.token = undefined
            state.user = undefined
            state.isAuth = false

            void deleteCookie(AUTH_COOKIES.TOKEN)
            void deleteCookie(AUTH_COOKIES.SESSION)
        },
        saveSession: (state, { payload }: PayloadAction<string>) => {
            state.session = payload
            void setCookie(AUTH_COOKIES.SESSION, payload)
        }
    }
})

export const { login, logout, saveSession } = authSlice.actions

export default authSlice.reducer
