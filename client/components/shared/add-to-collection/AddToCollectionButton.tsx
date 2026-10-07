import React, { useState } from 'react'
import { Button, ButtonProps } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { openAuthDialog } from '@/app/applicationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'

import { AddToCollectionModal } from './AddToCollectionModal'

interface AddToCollectionButtonProps extends Omit<ButtonProps, 'onClick' | 'label' | 'icon'> {
    placeId?: string
    hideLabel?: boolean
}

/**
 * "Add to collection" action for a place. Lives next to the bookmark button and
 * mirrors it: same size, same secondary mode, auth dialog for guests.
 */
export const AddToCollectionButton: React.FC<AddToCollectionButtonProps> = ({
    placeId,
    hideLabel,
    mode = 'secondary',
    size = 'medium',
    ...props
}) => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()

    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const [open, setOpen] = useState(false)

    const label = t('collections_add-to-collection-button', { defaultValue: 'В коллекцию' })

    const handleClick = (event: React.MouseEvent) => {
        event.stopPropagation()

        if (!isAuth) {
            dispatch(openAuthDialog())
        } else {
            setOpen(true)
        }
    }

    return (
        <>
            <Button
                {...props}
                mode={mode}
                size={size}
                icon={'Layers'}
                label={hideLabel ? undefined : label}
                tooltip={hideLabel ? label : props.tooltip}
                disabled={!placeId || props.disabled}
                onClick={handleClick}
            />

            <AddToCollectionModal
                placeId={placeId}
                open={open}
                onClose={() => setOpen(false)}
            />
        </>
    )
}
