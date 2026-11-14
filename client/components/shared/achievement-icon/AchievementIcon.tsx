import React from 'react'

import Image from 'next/image'

import { IMG_HOST } from '@/config/env'

import { AwardBadge } from './AwardBadge'

interface AchievementIconProps {
    image?: string | null
    alt?: string
    size?: number
    /** For an award without a picture: its tier, category and group draw one (`AwardBadge`) */
    tier?: string
    category?: string
    group?: string
    className?: string
}

/**
 * The picture of an award: its own drawn one, or — until it is ready — a badge in the same
 * format drawn from the award's tier, category and group (a season's warm or cold).
 */
export const AchievementIcon: React.FC<AchievementIconProps> = ({
    image,
    alt = '',
    size = 36,
    tier,
    category,
    group,
    className
}) => {
    if (!image) {
        return (
            <AwardBadge
                size={size}
                tier={tier}
                category={category}
                group={group}
                className={className}
            />
        )
    }

    const src =
        image.startsWith('http://') || image.startsWith('https://')
            ? image
            : `${IMG_HOST?.replace(/\/$/, '')}/${image.replace(/^\//, '')}`

    return (
        <Image
            src={src}
            alt={alt}
            width={size / 1.414}
            height={size}
            unoptimized
            className={className}
            style={{ objectFit: 'contain' }}
        />
    )
}
