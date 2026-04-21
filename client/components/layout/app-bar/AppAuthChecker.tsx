import React, { useEffect, useState } from 'react'
import { getCookie } from 'cookies-next'

import { API } from '@/api'
import { login, logout, saveSession } from '@/app/authSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { AUTH_COOKIES } from '@/config/constants'

export const AppAuthChecker: React.FC = () => {
    const dispatch = useAppDispatch()

    const [session, setSession] = useState<string>(() => (getCookie(AUTH_COOKIES.SESSION) as string) ?? '')

    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const {
        data: meData,
        refetch,
        isSuccess
    } = API.useAuthGetMeQuery(undefined, {
        pollingInterval: 60 * 1000,
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
                dispatch(logout())
            }
        }
    }, [meData?.auth])

    useEffect(() => {
        if (isAuth !== meData?.auth) {
            void refetch()
        }
    }, [isAuth])

    return <></>
}
