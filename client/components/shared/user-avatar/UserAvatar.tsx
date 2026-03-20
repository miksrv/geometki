import React from 'react'
import { cn } from 'simple-react-ui-kit'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next'

import defaultAvatar from '@/public/images/no-avatar.png'

import { AvatarImage } from './AvatarImage'
import { UserAvatarProps } from './types'
import { getDimension } from './utils'

import styles from './styles.module.sass'

export const UserAvatar: React.FC<UserAvatarProps> = (props) => {
    const { t } = useTranslation('components.user-avatar')
    const { className, user, size, caption, showName, disableLink } = props

    return (
        <div className={cn(styles.userAvatar, className)}>
            {user?.id ? (
                disableLink ? (
                    <span
                        className={styles.avatarLink}
                        style={{
                            height: getDimension(size),
                            width: getDimension(size)
                        }}
                    >
                        <AvatarImage {...props} />
                    </span>
                ) : (
                    <Link
                        className={styles.avatarLink}
                        href={`/users/${user.id}`}
                        title={`${t('user-profile', { defaultValue: 'Профиль путешественника' })} ${user.name}`}
                        style={{
                            height: getDimension(size),
                            width: getDimension(size)
                        }}
                    >
                        <AvatarImage {...props} />
                    </Link>
                )
            ) : (
                <Image
                    alt={''}
                    className={styles.avatarImage}
                    src={defaultAvatar.src}
                    width={getDimension(size)}
                    height={getDimension(size)}
                />
            )}

            {showName && (
                <div className={cn(styles.info, size === 'medium' ? styles.medium : styles.small)}>
                    {user?.id && user.name ? (
                        <Link
                            href={`/users/${user.id}`}
                            title={`${t('user-profile', { defaultValue: 'Профиль путешественника' })} ${user.name}`}
                        >
                            {user.name}
                        </Link>
                    ) : (
                        <span>{t('guest-user', { defaultValue: 'Гость' })}</span>
                    )}
                    {caption && <div className={styles.caption}>{caption}</div>}
                </div>
            )}
        </div>
    )
}
