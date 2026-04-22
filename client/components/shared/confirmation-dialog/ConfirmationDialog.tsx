import React from 'react'
import { Button, Dialog } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next'

import styles from './styles.module.sass'

interface ConfirmationDialogProps {
    open: boolean
    message: string
    onConfirm: () => void
    onCancel: () => void
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({ open, message, onConfirm, onCancel }) => {
    const { t } = useTranslation()

    return (
        <Dialog
            open={open}
            contentClassName={styles.dialog}
            onCloseDialog={onCancel}
        >
            <p className={styles.message}>{message}</p>
            <div className={styles.actions}>
                <Button
                    mode={'secondary'}
                    size={'medium'}
                    onClick={onCancel}
                >
                    {t('cancel')}
                </Button>
                <Button
                    mode={'primary'}
                    variant={'negative'}
                    size={'medium'}
                    onClick={onConfirm}
                >
                    {t('delete')}
                </Button>
            </div>
        </Dialog>
    )
}

// For dynamic import with next/dynamic
export default ConfirmationDialog
