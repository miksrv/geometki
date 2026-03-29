import React from 'react'

import Image from 'next/image'

import { IMG_HOST } from '@/config/env'
import { minutesAgo } from '@/utils/helpers'

import { UserAvatarProps } from './types'
import { getDimension, getInitials } from './utils'

import styles from './styles.module.sass'

export const AvatarImage: React.FC<UserAvatarProps> = ({ user, size, hideOnlineIcon }) => {
    const dimension = getDimension(size)
    const hasAvatar = !!user?.avatar

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

            {!hideOnlineIcon && user?.activity?.date && minutesAgo(user.activity.date) <= 15 && (
                <div className={styles.online} />
            )}
        </>
    )
}
