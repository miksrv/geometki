'use client'

import React, { useEffect } from 'react'

import { API } from '@/api'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { login, logout, saveSession } from '@/app/authSlice'
import { LOCAL_STORAGE } from '@/config/constants'
import useLocalStorage from '@/hooks/useLocalStorage'

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
