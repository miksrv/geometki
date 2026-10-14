import { API } from '@/api'
import { unsubscribe as unsubscribePush } from '@/utils/push'

import { logout } from './authSlice'
import type { AppDispatch, RootState } from './store'

/**
 * Logs the user out (the menu, or the server saying the session is gone). When a signed-in user
 * leaves, the cached API responses are dropped too: they carry that user's own state (bookmarks,
 * visits), and the next user must not see it. An anonymous visitor keeps the cache: resetting it
 * would refetch `authGetMe`, which logs out again, in a loop.
 */
export const logoutUser = () => (dispatch: AppDispatch, getState: () => RootState) => {
    const wasAuth = getState().auth.isAuth === true

    dispatch(logout())

    if (wasAuth) {
        dispatch(API.util.resetApiState())
    }
}

/**
 * Signing out from the menu also turns push off on this device: the next person on this
 * browser must not get the previous user's notifications. The server record goes by its
 * endpoint (no auth needed), so it works after the token is dropped too. Signing out because
 * the session expired keeps push: the device still belongs to that user.
 */
export const turnOffPushOnThisDevice = () => async (dispatch: AppDispatch) => {
    try {
        const endpoint = await unsubscribePush()

        if (endpoint) {
            await dispatch(API.endpoints.pushDeleteSubscription.initiate(endpoint))
        }
    } catch {
        // Nothing to turn off, or the server will drop the dead device by itself
    }
}
