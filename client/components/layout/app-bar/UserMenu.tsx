import React from 'react'
import { TFunction } from 'i18next'
import { Icon, Popout } from 'simple-react-ui-kit'

import Link from 'next/link'

import { ApiModel } from '@/api'
import { LevelProgress, UserAvatar } from '@/components/shared'

import styles from './styles.module.sass'

interface UserMenuProps {
    t: TFunction
    user?: ApiModel.User
    onLogout?: () => void
}

export const UserMenu: React.FC<UserMenuProps> = ({ t, user, onLogout }) => (
    <Popout
        position={'right'}
        closeOnChildrenClick={true}
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
                <LevelProgress
                    levelData={user?.levelData}
                    badgeSize={20}
                />
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
                {user?.role === 'admin' && (
                    <>
                        <li>
                            <Link href={'/admin/achievements'}>
                                <Icon name={'Award'} />
                                {t('app-layout.admin-achievements', { defaultValue: 'Настройки наград' })}
                            </Link>
                        </li>
                        <li>
                            <Link href={'/admin/sending-mail'}>
                                <Icon name={'Feed'} />
                                {t('app-layout.admin-sending-mail', { defaultValue: 'Отправленные письма' })}
                            </Link>
                        </li>
                    </>
                )}
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
