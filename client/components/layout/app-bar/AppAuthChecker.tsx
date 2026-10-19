import React, { useEffect, useState } from 'react'
import { getCookie } from 'cookies-next'

import { API } from '@/api'
import { login, saveSession } from '@/app/authSlice'
import { logoutUser } from '@/app/logoutUser'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { AUTH_COOKIES } from '@/config/constants'

export const AppAuthChecker: React.FC = () => {
    const dispatch = useAppDispatch()

    const [session, setSession] = useState<string>(() => (getCookie(AUTH_COOKIES.SESSION) as string) ?? '')

    const isAuth = useAppSelector((state) => state.auth.isAuth)
    const hasToken = !!useAppSelector((state) => state.auth.token)

    // Only a signed-in visitor is polled (a sign-out or an expired token elsewhere). A guest is
    // never asked: their session starts with their first score (PUT rating), not on every
    // first visit — crawlers rendering pages kept no cookie and made a session a page
    const skip = !hasToken

    const {
        data: meData,
        refetch,
        isSuccess
    } = API.useAuthGetMeQuery(undefined, {
        pollingInterval: hasToken ? 60 * 1000 : 0,
        skip,
        skipPollingIfUnfocused: true
    })

    useEffect(() => {
        if (isSuccess) {
            if (meData.session && session !== meData.session) {
                setSession(meData.session)
                dispatch(saveSession(meData.session))
            }

            if (meData.auth === true) {
                dispatch(login(meData))
            } else if (meData.auth === false) {
                dispatch(logoutUser())
            }
        }
    }, [meData?.auth])

    useEffect(() => {
        // A skipped query has nothing to refetch: signing in sets the token and starts it
        if (!skip && isAuth !== meData?.auth) {
            void refetch()
        }
    }, [isAuth])

    return <></>
}
