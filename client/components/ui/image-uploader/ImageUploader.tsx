import React from 'react'
import { cn } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import styles from './styles.module.sass'

interface PhotoGalleryProps {
    disabled?: boolean
    onClick?: () => void
}

export const ImageUploader: React.FC<PhotoGalleryProps> = ({ disabled, onClick }) => {
    const { t } = useTranslation()

    return (
        <button
            className={cn(styles.photoUploadSection, disabled && styles.disabled)}
            onClick={onClick}
        >
            <div className={styles.image} />
            <div>{t('click-here-upload-photos')}</div>
            <div className={styles.hint}>{t('supported-formats')} JPG, JPEG, PNG</div>
        </button>
    )
}
