import React from 'react'

import Image from 'next/image'

import { IMG_HOST } from '@/config/env'
import defaultAvatar from '@/public/images/no-avatar.png'
import { minutesAgo } from '@/utils/helpers'

import { UserAvatarProps } from './types'
import { getDimension } from './utils'

import styles from './styles.module.sass'

export const AvatarImage: React.FC<UserAvatarProps> = ({ user, size, hideOnlineIcon }) => (
    <>
        <Image
            alt={''}
            className={styles.avatarImage}
            src={user?.avatar ? `${IMG_HOST}${user.avatar}` : defaultAvatar.src}
            width={getDimension(size)}
            height={getDimension(size)}
        />

        <div
            aria-hidden={true}
            className={styles.avatarBorder}
        />

        {!hideOnlineIcon && user?.activity?.date && minutesAgo(user.activity.date) <= 15 && (
            <div className={styles.online} />
        )}
    </>
)
