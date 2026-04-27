import React from 'react'
import { cn } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { AvatarImage } from './AvatarImage'
import { UserAvatarProps } from './types'
import { getDimension, getInitials } from './utils'

import styles from './styles.module.sass'

export const UserAvatar: React.FC<UserAvatarProps> = (props) => {
    const { t } = useTranslation('components.user-avatar')
    const { className, user, size, caption, showName, disableLink } = props
    const dimension = getDimension(size)

    return (
        <div className={cn(styles.userAvatar, className)}>
            {user?.id ? (
                disableLink ? (
                    <span
                        className={styles.avatarLink}
                        style={{
                            height: dimension,
                            width: dimension
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
                            height: dimension,
                            width: dimension
                        }}
                    >
                        <AvatarImage {...props} />
                    </Link>
                )
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
