import { API } from '@/api'
import { login } from '@/app/authSlice'
import { AppStore } from '@/app/store'
import { AUTH_COOKIES } from '@/config/constants'

/**
 * Reads auth cookies from an SSR request and pre-populates the Redux store
 * so that RTK Query `prepareHeaders` has token/session available for SSR API calls.
 *
 * Call this at the START of every getServerSideProps, before any store.dispatch(API…).
 */
export const hydrateAuthFromCookies = (store: AppStore, cookies: Partial<Record<string, string>>): void => {
    const token = cookies[AUTH_COOKIES.TOKEN] ?? ''
    const session = cookies[AUTH_COOKIES.SESSION] ?? ''

    if (token || session) {
        store.dispatch(
            login({
                auth: !!token,
                session: session || undefined,
                token: token || undefined
            })
        )
    }
}

/**
 * Whether an SSR request is an admin's (call after hydrateAuthFromCookies). `auth/me` is asked
 * only with a token: a guest, or a crawler on an admin page, has nothing to ask about
 */
export const isAdminRequest = async (store: AppStore): Promise<boolean> => {
    if (!store.getState().auth.token) {
        return false
    }

    const { data } = await store.dispatch(API.endpoints.authGetMe.initiate())

    return data?.user?.role === 'admin'
}
