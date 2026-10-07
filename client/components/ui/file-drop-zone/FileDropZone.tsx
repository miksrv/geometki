import React, { useRef, useState } from 'react'
import { cn, Icon } from 'simple-react-ui-kit'

import styles from './styles.module.sass'

interface FileDropZoneProps {
    /** Text of the overlay shown while files are dragged over the zone */
    label: string
    /** Smaller second line of the overlay (accepted formats, limits) */
    hint?: string
    disabled?: boolean
    className?: string
    children?: React.ReactNode
    onDrop?: (files: File[]) => void
}

const hasFiles = (event: React.DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files')

/**
 * Wraps a block that accepts files dragged from the computer: while files are over it,
 * an overlay with `label` covers the block, and dropping them hands them to `onDrop`.
 * Text, links and images dragged inside the page are ignored.
 */
export const FileDropZone: React.FC<FileDropZoneProps> = ({ label, hint, disabled, className, children, onDrop }) => {
    const [active, setActive] = useState(false)
    // dragenter/dragleave also fire for every child crossed, so the zone counts them
    const depthRef = useRef(0)

    const reset = () => {
        depthRef.current = 0
        setActive(false)
    }

    const handleDragEnter = (event: React.DragEvent) => {
        if (disabled || !hasFiles(event)) {
            return
        }
        event.preventDefault()
        depthRef.current += 1
        setActive(true)
    }

    const handleDragOver = (event: React.DragEvent) => {
        if (!hasFiles(event)) {
            return
        }
        // Required for the element to become a drop target. A disabled zone still takes the drop
        // (and ignores it): otherwise the browser opens the file in the tab and the page is lost
        event.preventDefault()
        event.dataTransfer.dropEffect = disabled ? 'none' : 'copy'
    }

    const handleDragLeave = (event: React.DragEvent) => {
        if (disabled || !hasFiles(event)) {
            return
        }
        depthRef.current = Math.max(0, depthRef.current - 1)
        if (!depthRef.current) {
            setActive(false)
        }
    }

    const handleDrop = (event: React.DragEvent) => {
        if (!hasFiles(event)) {
            return
        }
        event.preventDefault()
        reset()

        if (disabled) {
            return
        }

        onDrop?.(Array.from(event.dataTransfer.files))
    }

    return (
        <div
            className={cn(styles.fileDropZone, className)}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {children}

            {active && (
                <div
                    className={styles.overlay}
                    aria-hidden={true}
                >
                    <Icon
                        name={'Photo'}
                        className={styles.icon}
                    />
                    <div className={styles.label}>{label}</div>
                    {hint && <div className={styles.hint}>{hint}</div>}
                </div>
            )}
        </div>
    )
}
