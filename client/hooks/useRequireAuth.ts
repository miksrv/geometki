import React, { useCallback } from 'react'

import { openAuthDialog } from '@/app/applicationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'

/**
 * Guard for actions that need a signed-in user (add a place, bookmark, comment, …). Returns a
 * function to call from the action's click handler: for a guest it cancels the event (a link to
 * a protected page would only end in the proxy's redirect) and opens the auth dialog, and
 * returns false; for a signed-in user it returns true and lets the action go on.
 */
const useRequireAuth = () => {
    const dispatch = useAppDispatch()
    const isAuth = useAppSelector((state) => state.auth.isAuth)

    return useCallback(
        (event?: React.SyntheticEvent): boolean => {
            if (isAuth === true) {
                return true
            }

            event?.preventDefault()
            dispatch(openAuthDialog())

            return false
        },
        [dispatch, isAuth]
    )
}

export default useRequireAuth
