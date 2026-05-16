import React, { useMemo, useState } from 'react'
import { Button, Icon, Progress } from 'simple-react-ui-kit'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel } from '@/api'
import { useAppSelector } from '@/app/store'
import { AchievementBadge, Header } from '@/components/shared'
import { Reputation } from '@/components/ui'
import { IMG_HOST } from '@/config/env'
import defaultAvatar from '@/public/images/no-avatar.png'
import { formatDate, makeActiveLink, minutesAgo, removeProtocolFromUrl, timeAgo } from '@/utils/helpers'
import { levelImage, nextLevelPercentage } from '@/utils/levels'

import { UserAvatarEditor } from '../user-avatar-editor'

import styles from './styles.module.sass'

interface UserHeaderProps {
    user?: ApiModel.User
}

export const UserHeader: React.FC<UserHeaderProps> = ({ user }) => {
    const { t, i18n } = useTranslation()

    const appAuth = useAppSelector((state) => state.auth)

    const [replaceAvatar, setReplaceAvatar] = useState<string>('')

    const { data: achievementsData } = API.useGetUserAchievementsQuery(user?.id ?? '', { skip: !user?.id })

    const tierRank: Record<string, number> = { none: 0, bronze: 1, silver: 2, gold: 3 }

    const userAchievements = useMemo(() => {
        const all = (achievementsData?.data ?? []).filter((a) => !!a.earned_at)
        const best = new Map<string, (typeof all)[number]>()

        for (const achievement of all) {
            const existing = best.get(achievement.group_slug)

            if (!existing || (tierRank[achievement.tier] ?? 0) > (tierRank[existing.tier] ?? 0)) {
                best.set(achievement.group_slug, achievement)
            }
        }

        return Array.from(best.values())
    }, [achievementsData])

    return (
        <section className={styles.component}>
            <div className={styles.content}>
                <div className={styles.avatarColumn}>
                    <Image
                        className={styles.avatar}
                        alt={user?.name || ''}
                        priority={true}
                        height={260}
                        width={260}
                        src={
                            user?.avatar || replaceAvatar
                                ? `${IMG_HOST}${replaceAvatar ? replaceAvatar : user?.avatar}`
                                : defaultAvatar.src
                        }
                    />
                    <Progress
                        height={4}
                        value={nextLevelPercentage(
                            user?.levelData?.experience || 0,
                            user?.levelData?.nextLevel || user?.levelData?.experience || 0
                        )}
                    />
                </div>
                <div className={styles.infoColumn}>
                    <div className={styles.infoRow}>
                        <ul className={styles.information}>
                            <li>
                                <Icon name={'StarEmpty'} />
                                <div className={styles.key}>{t('reputation')}:</div>
                                <div className={styles.value}>
                                    <Reputation value={user?.reputation || 0} />
                                </div>
                            </li>
                            <li>
                                <Icon name={'Award'} />
                                <div className={styles.key}>{t('level')}:</div>
                                <div className={styles.value}>
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
                                        title={user?.levelData?.title || ''}
                                    >
                                        {user?.levelData?.title}
                                    </Link>
                                </div>
                            </li>
                            <li>
                                <Icon name={'DoubleUp'} />
                                <div className={styles.key}>{t('experience-to-new-level')}:</div>
                                <div className={styles.value}>
                                    {(user?.levelData?.nextLevel || 0) - (user?.levelData?.experience || 0)}
                                </div>
                            </li>
                            <li>
                                <Icon name={'Time'} />
                                <div className={styles.key}>{t('registration')}:</div>
                                <div className={styles.value}>{formatDate(user?.created?.date, t('date-format'))}</div>
                            </li>
                            <li>
                                <Icon name={'Time'} />
                                <div className={styles.key}>{t('was-here')}:</div>
                                <div className={styles.value}>
                                    {minutesAgo(user?.activity?.date) <= 15 ? (
                                        <span className={styles.online}>
                                            <div className={styles.signOnline}></div>
                                            {t('online')}
                                        </span>
                                    ) : (
                                        timeAgo(user?.activity?.date ?? user?.updated?.date, undefined, i18n.language)
                                    )}
                                </div>
                            </li>
                            <li>
                                <Icon name={'Link'} />
                                <div className={styles.key}>{t('personal-page')}:</div>
                                <div className={styles.value}>
                                    {user?.website ? (
                                        <Link
                                            href={makeActiveLink(user.website)}
                                            className={'external'}
                                            target={'_blank'}
                                            title={removeProtocolFromUrl(user.website)}
                                        >
                                            {removeProtocolFromUrl(user.website)}
                                        </Link>
                                    ) : (
                                        <i>{t('not-specified')}</i>
                                    )}
                                </div>
                            </li>
                        </ul>
                        <div className={styles.rightColumn}>
                            <ul className={styles.information}>
                                <li>
                                    <div className={styles.key}>{t('added-geotags')}:</div>
                                    <div className={styles.value}>{user?.statistic?.place}</div>
                                </li>
                                <li>
                                    <div className={styles.key}>{t('photos-uploaded')}:</div>
                                    <div className={styles.value}>{user?.statistic?.photo}</div>
                                </li>
                                <li>
                                    <div className={styles.key}>{t('ratings-added')}:</div>
                                    <div className={styles.value}>{user?.statistic?.rating}</div>
                                </li>
                                <li>
                                    <div className={styles.key}>{t('added-comments')}:</div>
                                    <div className={styles.value}>{user?.statistic?.comment}</div>
                                </li>
                                <li>
                                    <div className={styles.key}>{t('editions')}:</div>
                                    <div className={styles.value}>{user?.statistic?.edit}</div>
                                </li>
                                <li>
                                    <div className={styles.key}>{t('places-visited')}:</div>
                                    <div className={styles.value}>{user?.statistic?.visited}</div>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {userAchievements.length > 0 && (
                        <div className={styles.achievementsBadges}>
                            {userAchievements.slice(0, 10).map((achievement) => (
                                <AchievementBadge
                                    key={achievement.id}
                                    achievement={achievement}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <Header
                title={user?.name}
                homePageTitle={t('geotags')}
                currentPage={user?.name}
                attachedBottom={true}
                links={[
                    {
                        link: '/users/',
                        text: t('users')
                    }
                ]}
                actions={
                    appAuth.isAuth &&
                    appAuth.user?.id === user?.id && (
                        <>
                            <UserAvatarEditor onSaveAvatar={setReplaceAvatar} />

                            <Button
                                size={'medium'}
                                icon={'Pencil'}
                                mode={'secondary'}
                                label={t('settings')}
                                link={'/users/settings'}
                            />
                        </>
                    )
                }
            />
        </section>
    )
}
