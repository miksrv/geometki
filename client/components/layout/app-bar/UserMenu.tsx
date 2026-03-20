import React from 'react'
import { TFunction } from 'i18next'
import { Icon, Popout } from 'simple-react-ui-kit'

import Image from 'next/image'
import Link from 'next/link'

import { ApiModel } from '@/api'
import { UserAvatar } from '@/components/shared'
import { levelImage } from '@/functions/userLevels'

import styles from './styles.module.sass'

interface UserMenuProps {
    t: TFunction
    user?: ApiModel.User
    onLogout?: () => void
}

export const UserMenu: React.FC<UserMenuProps> = ({ t, user, onLogout }) => (
    <Popout
        trigger={
            <UserAvatar
                size={'medium'}
                user={user}
                disableLink={true}
                hideOnlineIcon={true}
            />
        }
    >
        <div className={styles.userMenuPopout}>
            <div className={styles.userInfo}>
                <div className={styles.userName}>{user?.name}</div>
                <div>
                    [<b>{user?.levelData?.level}</b>]{' '}
                    <Image
                        className={styles.levelImage}
                        src={levelImage(user?.levelData?.level).src}
                        alt={''}
                        width={20}
                        height={20}
                    />{' '}
                    <Link
                        href={'/users/levels'}
                        title={t('app-layout.go-to-levels_title', { defaultValue: 'Перейти к уровням' })}
                    >
                        {user?.levelData?.title}
                    </Link>
                </div>
                <div>
                    {t('userMenu.untilNextLevel', { defaultValue: 'До нового уровня:' })}{' '}
                    {(user?.levelData?.nextLevel || 0) - (user?.levelData?.experience || 0)}
                </div>
            </div>
            <ul className={'contextListMenu'}>
                <li>
                    <Link
                        href={`/users/${user?.id}`}
                        title={t('app-layout.go-to-my-page_title', { defaultValue: 'Перейти на мою страницу' })}
                    >
                        <Icon name={'User'} />
                        {t('app-layout.my-page', { defaultValue: 'Моя страница' })}
                    </Link>
                </li>
                <li>
                    <Link
                        href={'/users/settings'}
                        title={t('app-layout.go-to-settings_title', { defaultValue: 'Перейти в настройки' })}
                    >
                        <Icon name={'Settings'} />
                        {t('app-layout.settings', { defaultValue: 'Настройки' })}
                    </Link>
                </li>
                <li>
                    <Link
                        href={'/'}
                        title={t('app-layout.logout', { defaultValue: 'Выйти' })}
                        onClick={(event) => {
                            event.preventDefault()
                            onLogout?.()
                        }}
                    >
                        <Icon name={'Exit'} />
                        {t('app-layout.logout', { defaultValue: 'Выйти' })}
                    </Link>
                </li>
            </ul>
        </div>
    </Popout>
)
