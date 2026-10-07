import React from 'react'
import { Tooltip } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { Notify } from '@/app/notificationSlice'
import { useAppDispatch } from '@/app/store'
import { convertDMS } from '@/utils/coordinates'

interface CopyCoordinatesProps {
    lat: number
    lon: number
    onCopy?: () => void
}

export const CopyCoordinates: React.FC<CopyCoordinatesProps> = ({ lat, lon, onCopy }) => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()

    const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault()
        await navigator.clipboard.writeText(`${lat} ${lon}`)
        onCopy?.()

        await dispatch(
            Notify({
                id: 'copyCoordinates',
                message: t('coordinates-copied'),
                title: '',
                type: 'info'
            })
        )
    }

    return (
        <Tooltip content={t('copy-to-clipboard')}>
            <a
                href={'#'}
                rel={'nofollow'}
                onClick={handleClick}
            >
                {convertDMS(lat, lon)}
            </a>
        </Tooltip>
    )
}
