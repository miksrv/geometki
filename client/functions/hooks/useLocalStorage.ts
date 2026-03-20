import React, { useDebugValue, useEffect, useState } from 'react'

import type { LOCAL_STORAGE } from '@/config/constants'
import * as LocalStorage from '@/utils/localstorage'

export const useLocalStorage = <S>(
    key: string,
    initialState?: S | (() => S)
): [S, React.Dispatch<React.SetStateAction<S>>] => {
    const [state, setState] = useState<S>(initialState as S)

    useDebugValue(state)

    useEffect(() => {
        const item = LocalStorage.getItem(key as keyof typeof LOCAL_STORAGE)
        setState((item ?? null) as S)
    }, [])

    useEffect(() => {
        if (state) {
            LocalStorage.setItem(key as keyof typeof LOCAL_STORAGE, state as string | number)
        }
    }, [state])

    return [state, setState]
}

export default useLocalStorage
