import React from 'react'
import { Icon, IconTypes } from 'simple-react-ui-kit'

import Image from 'next/image'

import { IMG_HOST } from '@/config/env'

interface AchievementIconProps {
    image?: string | null
    icon?: string
    alt?: string
    size?: number
    className?: string
    style?: React.CSSProperties
}

export const AchievementIcon: React.FC<AchievementIconProps> = ({
    image,
    icon,
    alt = '',
    size = 36,
    className,
    style
}) => {
    if (image) {
        const src = image.startsWith('http://') || image.startsWith('https://') ? image : `${IMG_HOST}${image}`
        return (
            <Image
                src={src}
                alt={alt}
                width={size}
                height={size}
                className={className}
                style={{ objectFit: 'contain', ...style }}
            />
        )
    }

    return (
        <Icon
            name={(icon ?? '') as IconTypes}
            style={{ fontSize: size !== 36 ? size : undefined, ...style }}
            className={className}
        />
    )
}
