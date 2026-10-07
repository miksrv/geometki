import { API } from '@/api'

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
