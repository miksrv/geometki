'use client'

import React, { useState } from 'react'
import { Button, Container } from 'simple-react-ui-kit'

import { ApiType } from '@/api'

import styles from './styles.module.sass'

interface CoordinatesControlProps {
    coordinates?: ApiType.Coordinates
    onChangeOpen?: (open: boolean) => void
}

export const CoordinatesControl: React.FC<CoordinatesControlProps> = ({ coordinates, onChangeOpen }) => {
    const [open, setOpen] = useState<boolean>(false)

    const handleToggleOpen = () => {
        setOpen(!open)
        onChangeOpen?.(!open)
    }

    return !open ? (
        <Button
            mode={'secondary'}
            icon={'PinDrop'}
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
