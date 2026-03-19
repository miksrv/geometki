'use client'

import React, { useEffect } from 'react'

import { API, useAppDispatch, useAppSelector } from '@/api'
import { login, logout, saveSession } from '@/api/authSlice'
import { LOCAL_STORAGE } from '@/functions/constants'
import useLocalStorage from '@/functions/hooks/useLocalStorage'

export const AppAuthChecker: React.FC = () => {
    const dispatch = useAppDispatch()

    const [session, setSession] = useLocalStorage<string>(LOCAL_STORAGE.AUTH_SESSION)

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
