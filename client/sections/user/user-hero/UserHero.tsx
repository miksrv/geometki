import React, { useState } from 'react'
import { Button } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { useAppSelector } from '@/app/store'
import { UserProfileCard, UserProfileSection } from '@/components/shared'
import { Breadcrumbs } from '@/components/ui'

import styles from './styles.module.sass'

const UserAvatarEditor = dynamic(() => import('../user-avatar-editor').then((m) => ({ default: m.UserAvatarEditor })), {
    ssr: false
})

interface UserHeroProps {
    user?: ApiModel.User
    /** The page of the profile shown: underlined among the links at the foot of the card */
    currentPage?: UserProfileSection
}

/**
 * The head of every page of a profile (DESIGN.md → Person): the breadcrumbs, then the
 * `UserProfileCard` of the person with the pages of the profile at its foot. The owner gets
 * "Сменить фото" and "Настройки" under the level; anyone else sees the same card without buttons.
 */
export const UserHero: React.FC<UserHeroProps> = ({ user, currentPage }) => {
    const { t } = useTranslation()

    const isOwner = useAppSelector((state) => !!user?.id && state.auth.isAuth && state.auth.user?.id === user.id)

    // The new photo at once, before the cached page is rendered anew
    const [newAvatar, setNewAvatar] = useState<string>()

    return (
        <header className={styles.hero}>
            <Breadcrumbs
                className={styles.breadcrumbs}
                links={[{ link: '/users', text: t('users') }]}
            />

            {user && (
                <UserProfileCard
                    user={user}
                    variant={'profile'}
                    avatarSrc={newAvatar}
                    activeSection={currentPage}
                    actions={
                        isOwner && (
                            <>
                                <UserAvatarEditor
                                    size={'small'}
                                    label={t('user-hero-change-avatar')}
                                    onSaveAvatar={(path) => path && setNewAvatar(path)}
                                />
                                <Button
                                    size={'small'}
                                    mode={'secondary'}
                                    icon={'Settings'}
                                    label={t('settings')}
                                    link={'/users/settings'}
                                />
                            </>
                        )
                    }
                />
            )}
        </header>
    )
}
