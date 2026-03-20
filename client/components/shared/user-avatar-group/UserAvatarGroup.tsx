import React from 'react'
import { cn } from 'simple-react-ui-kit'

import { Trans } from 'next-i18next'

import { ApiModel } from '@/api'

import { UserAvatar, UserAvatarProps } from '../user-avatar'

import styles from './styles.module.sass'

interface UserAvatarGroupProps extends Pick<UserAvatarProps, 'size'> {
    users?: ApiModel.User[]
    totalCount?: number
    className?: string
}

export const UserAvatarGroup: React.FC<UserAvatarGroupProps> = ({ users, totalCount, className, ...props }) => (
    <div className={cn(styles.avatarsGroup, className)}>
        {users?.map((user) => (
            <UserAvatar
                user={user}
                key={`avatar${user.id}`}
                size={props.size ?? 'tiny'}
                hideOnlineIcon={true}
            />
        ))}

        {totalCount && totalCount <= 99 ? <div className={styles.totalCountAvatar}>{`+${totalCount}`}</div> : <></>}

        {(totalCount ?? 0) > 99 && (
            <>
                <div className={styles.totalCountText}>
                    <Trans
                        i18nKey={'more-count-travelers'}
                        values={{ count: totalCount }}
                    />
                </div>
                <div className={styles.mobileCount}>{`+${totalCount}`}</div>
            </>
        )}
    </div>
)
