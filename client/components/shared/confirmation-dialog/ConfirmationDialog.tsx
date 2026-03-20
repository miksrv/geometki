import React from 'react'
import { Button, Dialog, DialogProps } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next'

import { useAppDispatch, useAppSelector } from '@/api'
import { toggleOverlay } from '@/api/applicationSlice'

import 'react-image-crop/src/ReactCrop.scss'
import styles from './styles.module.sass'

interface ConfirmationDialogProps extends DialogProps {
    open?: boolean
    message?: string
    acceptText?: string
    rejectText?: string
    onAccept?: () => void
    onReject?: () => void
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
    open,
    message,
    acceptText,
    rejectText,
    onAccept,
    onReject
}) => {
    const { t } = useTranslation()

    const dispatch = useAppDispatch()

    const overlay = useAppSelector((state) => state.application.showOverlay)

    const handleCoverDialogClose = () => {
        dispatch(toggleOverlay(false))
        onReject?.()
    }

    React.useEffect(() => {
        if (open && !overlay) {
            dispatch(toggleOverlay(true))
        } else if (!open && overlay) {
            dispatch(toggleOverlay(false))
        }
    }, [open])

    return (
        <Dialog
            maxWidth={'400px'}
            open={open}
            onCloseDialog={handleCoverDialogClose}
        >
            <p className={styles.message}>{message ?? t('confirmation-dialog-text')}</p>

            <div className={styles.bottomActions}>
                <Button
                    mode={'secondary'}
                    onClick={onReject}
                    label={rejectText ?? t('confirmation-dialog-reject')}
                />

                <Button
                    variant={'negative'}
                    mode={'primary'}
                    onClick={onAccept}
                    label={acceptText ?? t('confirmation-dialog-accept')}
                />
            </div>
        </Dialog>
    )
}

// For dynamic import with next/dynamic
export default ConfirmationDialog
