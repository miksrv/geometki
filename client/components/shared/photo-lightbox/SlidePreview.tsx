import React from 'react'
import { useController } from 'yet-another-react-lightbox'

import { fitToRect } from './utils'

import styles from './styles.module.sass'

interface SlidePreviewProps {
    /** The small preview the browser usually has already (a gallery tile, a map marker) */
    preview?: string
    width?: number
    height?: number
    children?: React.ReactNode
}

/**
 * Shows the photo's preview under the slide while the full photo loads, instead of an empty
 * black screen. The full photo is drawn over it, the preview fades out once it has loaded.
 */
export const SlidePreview: React.FC<SlidePreviewProps> = ({ preview, width, height, children }) => {
    const { slideRect } = useController()

    if (!preview) {
        return <>{children}</>
    }

    // With known sizes the preview takes exactly the box of the full photo; without them it is
    // stretched over the slide keeping its own proportions
    const box = width && height ? fitToRect(slideRect, width, height) : undefined

    return (
        <div className={styles.slide}>
            {/* A plain image on purpose: the same URL as the map marker, so it comes from the browser cache */}
            {/* eslint-disable-next-line next/no-img-element */}
            <img
                src={preview}
                alt={''}
                aria-hidden={true}
                draggable={false}
                className={styles.preview}
                style={box ?? { height: '100%', objectFit: 'contain', width: '100%' }}
            />
            <div className={styles.content}>{children}</div>
        </div>
    )
}
