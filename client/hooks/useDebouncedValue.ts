import { useEffect, useState } from 'react'

/** The value, as it was `delay` ms ago and stayed: a request that follows typing waits for the pause */
export const useDebouncedValue = <T>(value: T, delay: number): T => {
    const [debounced, setDebounced] = useState<T>(value)

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay)

        return () => clearTimeout(timer)
    }, [value, delay])

    return debounced
}
