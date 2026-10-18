import React from 'react'

import Image from 'next/image'

import { IMG_HOST } from '@/config/env'
import useClientOnly from '@/hooks/useClientOnly'
import { minutesAgo } from '@/utils/helpers'

import { UserAvatarProps } from './types'
import { getDimension, getInitials } from './utils'

import styles from './styles.module.sass'

export const AvatarImage: React.FC<UserAvatarProps> = ({ user, size, hideOnlineIcon }) => {
    const dimension = getDimension(size)
    const hasAvatar = !!user?.avatar
    // The online mark only in the browser: a cached page (a place page is kept for a day) would
    // carry the mark of when it was rendered, and hydration would trip over a dot that is gone
    const isClient = useClientOnly()

    return (
        <>
            {hasAvatar ? (
                <Image
                    alt={''}
                    className={styles.avatarImage}
                    src={`${IMG_HOST}${user.avatar}`}
                    width={dimension}
                    height={dimension}
                />
            ) : (
                <div
                    className={styles.initialsAvatar}
                    style={{
                        width: dimension,
                        height: dimension,
                        fontSize: dimension * 0.4
                    }}
                >
                    {getInitials(user?.name)}
                </div>
            )}

            <div
                aria-hidden={true}
                className={styles.avatarBorder}
            />

            {isClient && !hideOnlineIcon && user?.activity?.date && minutesAgo(user.activity.date) <= 15 && (
                <div className={styles.online} />
            )}
        </>
    )
}
