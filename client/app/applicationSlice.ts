import { getCookie, setCookie } from 'cookies-next'

import { createSlice, PayloadAction, UnknownAction } from '@reduxjs/toolkit'

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
    /** The user just did something worth hearing back about: offer push (PushPrompt) */
    pushPromptRequested?: boolean
}

/**
 * Requests after which the push offer makes sense: the user added a place, a photo, a rating
 * or a comment, and others' reactions to it are what push brings. Matched by the RTK Query
 * action, not the endpoint objects, so this slice does not import the API.
 */
const PUSH_PROMPT_ENDPOINTS = new Set(['placesPostItem', 'photoPostUpload', 'ratingPutScore', 'commentsPost'])

const isPushPromptTrigger = (action: UnknownAction): boolean =>
    action.type === 'api/executeMutation/fulfilled' &&
    PUSH_PROMPT_ENDPOINTS.has(
        (action as UnknownAction & { meta?: { arg?: { endpointName?: string } } }).meta?.arg?.endpointName ?? ''
    )

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
        },
        dismissPushPrompt: (state) => {
            state.pushPromptRequested = false
        }
    },
    extraReducers: (builder) => {
        builder
            .addMatcher(isPushPromptTrigger, (state) => {
                state.pushPromptRequested = true
            })
            // An offer earned by one account is not shown to the next one on this tab
            .addMatcher(
                (action: UnknownAction) => action.type === 'auth/logout',
                (state) => {
                    state.pushPromptRequested = false
                }
            )
    }
})

export const { toggleOverlay, closeAuthDialog, openAuthDialog, setLocale, setUserLocation, dismissPushPrompt } =
    applicationSlice.actions

export default applicationSlice.reducer
