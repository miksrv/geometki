import { getCookie, setCookie } from 'cookies-next'

import { createSlice, PayloadAction } from '@reduxjs/toolkit'

import { ApiType } from '@/api'
import { LOCAL_STORAGE } from '@/config/constants'
import * as LocalStorage from '@/utils/localstorage'
import {
    parseUserLocation,
    serializeUserLocation,
    USER_LOCATION_COOKIE,
    USER_LOCATION_MAX_AGE
} from '@/utils/userLocation'

import i18Config from '../next-i18next.config'

type ApplicationStateProps = {
    showOverlay?: boolean
    showAuthDialog?: boolean
    userLocation?: ApiType.Coordinates
    locale?: ApiType.Locale
}

export const getStorageLocale = (): string | undefined =>
    typeof window !== 'undefined'
        ? (LocalStorage.getItem(LOCAL_STORAGE.LOCALE as 'LOCALE') ?? i18Config.i18n.defaultLocale)
        : i18Config.i18n.defaultLocale

export const getStorageUserLocation = (): ApiType.Coordinates | undefined =>
    typeof window !== 'undefined' ? parseUserLocation(getCookie(USER_LOCATION_COOKIE) as string | undefined) : undefined

const applicationSlice = createSlice({
    initialState: {
        locale: getStorageLocale(),
        showAuthDialog: false,
        showOverlay: false,
        userLocation: getStorageUserLocation()
    } as ApplicationStateProps,
    name: 'application',
    reducers: {
        closeAuthDialog: (state) => {
            state.showOverlay = false
            state.showAuthDialog = false
        },
        openAuthDialog: (state) => {
            state.showOverlay = true
            state.showAuthDialog = true
        },
        setLocale: (state, { payload }: PayloadAction<ApiType.Locale>) => {
            state.locale = payload
        },
        setUserLocation: (state, { payload }: PayloadAction<ApiType.Coordinates>) => {
            void setCookie(USER_LOCATION_COOKIE, serializeUserLocation(payload), { maxAge: USER_LOCATION_MAX_AGE })

            state.userLocation = payload
        },
        toggleOverlay: (state, { payload }: PayloadAction<boolean>) => {
            state.showOverlay = payload
        }
    }
})

export const { toggleOverlay, closeAuthDialog, openAuthDialog, setLocale, setUserLocation } = applicationSlice.actions

export default applicationSlice.reducer
