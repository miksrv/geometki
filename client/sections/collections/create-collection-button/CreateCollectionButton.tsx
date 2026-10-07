import React, { useState } from 'react'
import { Button, ButtonProps } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { openAuthDialog } from '@/app/applicationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'

import { CreateCollectionDialog } from '../create-collection-dialog'

type CreateCollectionButtonProps = Omit<ButtonProps, 'onClick' | 'label' | 'icon'>

/**
 * "Create collection" entry point for list pages. Guests get the auth dialog,
 * signed-in users get the create dialog and land on the new collection page.
 * `secondary` by default: the one primary action in the chrome is "Add place" in the app bar.
 */
export const CreateCollectionButton: React.FC<CreateCollectionButtonProps> = ({
    mode = 'secondary',
    size = 'medium',
    ...props
}) => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()

    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const [open, setOpen] = useState(false)

    const handleClick = () => {
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
                label={t('collections_create-button', { defaultValue: 'Создать коллекцию' })}
                onClick={handleClick}
            />

            <CreateCollectionDialog
                open={open}
                onClose={() => setOpen(false)}
            />
        </>
    )
}
