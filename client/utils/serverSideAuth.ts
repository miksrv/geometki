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
