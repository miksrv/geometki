import React from 'react'

import Image from 'next/image'

import { IMG_HOST } from '@/config/env'

interface AchievementIconProps {
    image?: string | null
    alt?: string
    size?: number
    className?: string
    style?: React.CSSProperties
}

export const AchievementIcon: React.FC<AchievementIconProps> = ({ image, alt = '', size = 36, className, style }) => {
    if (!image) {
        return null
    }

    const src =
        image.startsWith('http://') || image.startsWith('https://')
            ? image
            : `${IMG_HOST?.replace(/\/$/, '')}/${image.replace(/^\//, '')}`

    return (
        <Image
            src={src}
            alt={alt}
            width={size}
            height={size}
            unoptimized
            className={className}
            style={{ objectFit: 'contain', ...style }}
        />
    )
}
