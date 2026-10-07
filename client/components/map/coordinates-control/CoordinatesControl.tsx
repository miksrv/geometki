import React, { useState } from 'react'
import { Button, Container } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'

import styles from './styles.module.sass'

interface CoordinatesControlProps {
    coordinates?: ApiType.Coordinates
    onChangeOpen?: (open: boolean) => void
}

export const CoordinatesControl: React.FC<CoordinatesControlProps> = ({ coordinates, onChangeOpen }) => {
    const { t } = useTranslation()
    const [open, setOpen] = useState<boolean>(false)

    const handleToggleOpen = () => {
        setOpen(!open)
        onChangeOpen?.(!open)
    }

    return !open ? (
        <Button
            mode={'secondary'}
            icon={'PinDrop'}
            tooltip={t('coordinates-cursor', { defaultValue: 'Координаты курсора' })}
            onClick={handleToggleOpen}
        />
    ) : (
        <Container
            className={styles.coordinatesControl}
            onClick={handleToggleOpen}
        >
            <b>{'Lat:'}</b>
            <span>{coordinates?.lat}</span>
            <b>{'Lon:'}</b>
            <span>{coordinates?.lon}</span>
        </Container>
    )
}
