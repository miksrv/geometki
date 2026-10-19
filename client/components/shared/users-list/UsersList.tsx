import React from 'react'
import { Container, ContainerProps, Icon, Tooltip } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { Reputation } from '@/components/ui'
import useClientOnly from '@/hooks/useClientOnly'
import { formatThousands, timeAgo } from '@/utils/helpers'

import { LevelBadge } from '../level-badge/LevelBadge'
import { LevelProgress } from '../level-progress/LevelProgress'
import { UserAvatar } from '../user-avatar'

import styles from './styles.module.sass'

interface UsersListProps extends Pick<ContainerProps, 'title' | 'footer' | 'action'> {
    users?: ApiModel.User[]
    scrollable?: boolean
    compact?: boolean
}

export const UsersList: React.FC<UsersListProps> = ({ users, scrollable, compact, ...props }) => {
    const { t, i18n } = useTranslation()
    // The home page HTML is cached: "5 minutes ago" is counted in the browser
    const isClient = useClientOnly()

    if (!users?.length) {
        return (
            <Container className={'emptyList'}>
                {t('nothing-here-yet', { defaultValue: 'Тут пока ничего нет' })}
            </Container>
        )
    }

    const content = users.map((user) => {
        const experience = user.levelData?.experience ?? 0

        return (
            <div
                key={user.id}
                className={`${styles.usersListItem}${compact ? ` ${styles.compact}` : ''}`}
            >
                {/* Avatar + name + activity */}
                <div className={styles.userCol}>
                    <UserAvatar
                        showName={true}
                        user={user}
                        size={'medium'}
                        caption={isClient ? timeAgo(user.activity?.date, undefined, i18n.language) : '\u00A0'}
                    />
                </div>

                {/* Mobile and compact: level badge without the progress bar */}
                <div className={styles.mobileLevelBadge}>
                    <LevelBadge
                        level={user.levelData?.level}
                        size={compact ? 22 : 28}
                        showTooltip={compact}
                    />
                </div>

                {/* Desktop: level badge + progress + xp range (hidden in compact) */}
                {!compact && (
                    <div className={styles.levelCol}>
                        <LevelProgress levelData={user.levelData} />
                    </div>
                )}

                {/* Total XP (desktop, hidden in compact) */}
                {!compact && (
                    <div className={styles.xpCol}>
                        <strong>{formatThousands(experience)}</strong>
                        <span>{t('experience-points', { defaultValue: 'очки опыта' })}</span>
                    </div>
                )}

                {/* Reputation (desktop) */}
                <div className={styles.reputationCol}>
                    <Tooltip content={t('reputation', { defaultValue: 'Репутация' })}>
                        <Reputation value={user.reputation ?? 0} />
                    </Tooltip>
                </div>

                {/* Stats (hidden in compact) */}
                {!compact && (
                    <div className={styles.statsCol}>
                        <div className={styles.stat}>
                            <Icon
                                name={'Camera'}
                                tooltip={t('photos-uploaded', { defaultValue: 'Фотографий' })}
                            />
                            {user.statistic?.photo ?? 0}
                        </div>
                        <div className={styles.stat}>
                            <Icon
                                name={'Point'}
                                tooltip={t('geotags_count', { defaultValue: 'Геометок' })}
                            />
                            {user.statistic?.place ?? 0}
                        </div>
                        <div className={styles.stat}>
                            <Icon
                                name={'CheckCircle'}
                                tooltip={t('places-visited', { defaultValue: 'Посещено мест' })}
                            />
                            {user.statistic?.visited ?? 0}
                        </div>
                    </div>
                )}
            </div>
        )
    })

    return (
        <Container {...props}>
            {scrollable ? <div className={styles.scrollableContent}>{content}</div> : content}
        </Container>
    )
}
