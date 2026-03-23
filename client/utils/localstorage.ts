import { LOCAL_STORAGE, LOCAL_STORAGE_KEY } from '@/config/constants'
import { isValidJSON } from '@/utils/text'

const _getLocalStorage = (): undefined | typeof LOCAL_STORAGE => {
    if (typeof window === 'undefined') {
        return
    }

    const localstorageData = localStorage.getItem(LOCAL_STORAGE_KEY)

    if (localstorageData && !!localstorageData.length && isValidJSON(localstorageData)) {
        return JSON.parse(localstorageData) as typeof LOCAL_STORAGE
    }
}

export const getItem = (key: keyof typeof LOCAL_STORAGE): string => _getLocalStorage()?.[key] ?? ''

export const setItem = (key: keyof typeof LOCAL_STORAGE, value: string | number | undefined) => {
    if (typeof window === 'undefined') {
        return
    }

    const data = _getLocalStorage()
    const updateData = {
        ...data,
        [key]: value
    } as typeof LOCAL_STORAGE

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updateData))
}

export const removeItem = (key: keyof typeof LOCAL_STORAGE) => {
    setItem(key, undefined)
}
