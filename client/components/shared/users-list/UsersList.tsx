import React from 'react'
import { Container, ContainerProps, Progress } from 'simple-react-ui-kit'

import Image from 'next/image'
import { useTranslation } from 'next-i18next'

import { ApiModel } from '@/api'
import { Reputation } from '@/components/ui'
import { levelImage, nextLevelPercentage } from '@/functions/userLevels'

import { UserAvatar } from '../user-avatar'

import styles from './styles.module.sass'

interface UsersListProps extends Pick<ContainerProps, 'title' | 'footer' | 'action'> {
    users?: ApiModel.User[]
}

export const UsersList: React.FC<UsersListProps> = ({ users, ...props }) => {
    const { t } = useTranslation('components.users-list')

    return users?.length ? (
        <Container
            {...props}
            style={{ marginTop: 15 }}
        >
            {users.map((user) => (
                <div
                    key={user.id}
                    className={styles.usersListItem}
                >
                    <UserAvatar
                        showName={true}
                        user={user}
                        size={'medium'}
                        caption={
                            <>
                                <Image
                                    className={styles.levelImage}
                                    src={levelImage(user.levelData?.level).src}
                                    alt={''}
                                    width={16}
                                    height={16}
                                />
                                {user.levelData?.level} {t('level', { defaultValue: 'Уровень' })}
                            </>
                        }
                    />

                    <div className={styles.metaContainer}>
                        <Reputation value={user.reputation || 0} />

                        <div className={styles.level}>
                            <p>{user.levelData?.title}</p>
                            <Progress
                                className={styles.progress}
                                height={4}
                                value={nextLevelPercentage(
                                    user.levelData?.experience || 0,
                                    user.levelData?.nextLevel || user.levelData?.experience || 0
                                )}
                            />
                        </div>
                    </div>
                </div>
            ))}
        </Container>
    ) : (
        <Container className={'emptyList'}>{t('nothing-here-yet', { defaultValue: 'Тут пока ничего нет' })}</Container>
    )
}
