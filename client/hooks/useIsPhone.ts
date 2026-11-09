import { useEffect, useState } from 'react'

import { MOBILE_MAX_WIDTH } from '@/config/constants'

const QUERY = `(max-width: ${MOBILE_MAX_WIDTH}px)`

/**
 * The screen is a phone's (`$mobileMaxWidth`, the one breakpoint): follows the window as it is
 * resized. False on the server and in the first client render, so the hydration agrees.
 */
const useIsPhone = (): boolean => {
    const [isPhone, setIsPhone] = useState<boolean>(false)

    useEffect(() => {
        const media = window.matchMedia?.(QUERY)

        if (!media) {
            return
        }

        const update = () => setIsPhone(media.matches)

        update()
        media.addEventListener('change', update)

        return () => media.removeEventListener('change', update)
    }, [])

    return isPhone
}

export default useIsPhone
