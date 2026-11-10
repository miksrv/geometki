import React from 'react'
import { cn, Icon, IconTypes } from 'simple-react-ui-kit'

import { FileDropZone } from '../file-drop-zone'

import styles from './styles.module.sass'

export interface UploadZoneProps {
    /** What to do, "Фото этого места пока нет" or "Выберите фото" */
    title: string
    /** How and what: "Нажмите или перетащите файлы сюда. JPG, PNG или WEBP, до 10 МБ" */
    hint?: string
    /** `Camera` by default */
    icon?: IconTypes
    disabled?: boolean
    className?: string
    /** Opens the file picker: the caller owns the file input and its checks */
    onClick?: () => void
    /**
     * Files dropped on the zone. Without it the zone takes no drops itself — for a zone inside
     * a `FileDropZone` that already takes them (the place page's photos, the place form)
     */
    onDrop?: (files: File[]) => void
}

/**
 * The one face of a photo upload (DESIGN.md → Patterns → Photo upload): a dashed field with an
 * icon, a title and a hint; a click opens the picker, files can be dropped on it.
 */
export const UploadZone: React.FC<UploadZoneProps> = ({
    title,
    hint,
    icon = 'Camera',
    disabled,
    className,
    onClick,
    onDrop
}) => {
    const zone = (
        <button
            type={'button'}
            className={cn(styles.uploadZone, !onDrop && className)}
            disabled={disabled}
            onClick={onClick}
        >
            <Icon name={icon} />
            <strong>{title}</strong>
            {hint && <span>{hint}</span>}
        </button>
    )

    if (!onDrop) {
        return zone
    }

    return (
        <FileDropZone
            className={className}
            label={title}
            hint={hint}
            disabled={disabled}
            onDrop={onDrop}
        >
            {zone}
        </FileDropZone>
    )
}
