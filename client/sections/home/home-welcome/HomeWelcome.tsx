import React from 'react'
import { Progress } from 'simple-react-ui-kit'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { LevelBadge } from '@/components/shared'
import { IMG_HOST } from '@/config/env'
import defaultAvatar from '@/public/images/no-avatar.png'
import { formatThousands } from '@/utils/helpers'
import { nextLevelPercentage } from '@/utils/levels'

import styles from './styles.module.sass'

interface HomeWelcomeProps {
    user: ApiModel.User
}

/**
 * A signed-in user's first screen instead of the guest hero: the big square avatar, then
 * three lines — the greeting, a short line about them, the progress to the next level —
 * and their counters on the right, each a link to that list of their profile.
 */
export const HomeWelcome: React.FC<HomeWelcomeProps> = ({ user }) => {
    const { t } = useTranslation()

    const firstName = user.name.split(' ')[0]
    const level = user.levelData?.level
    const experience = user.levelData?.experience ?? 0
    const nextLevel = user.levelData?.nextLevel ?? experience
    // The year as the API writes it ("2014-11-12 11:36:18"), not shifted by the reader's time zone
    const since = user.created?.date ? Number(user.created.date.slice(0, 4)) || undefined : undefined

    const facts = [
        since && t('home-welcome-since', { year: since }),
        level !== undefined &&
            t('home-welcome-experience-left', {
                experience: formatThousands(Math.max(nextLevel - experience, 0)),
                level: level + 1
            })
    ].filter(Boolean)

    const counters = [
        { count: user.statistic?.place, key: 'places', link: `/users/${user.id}/places` },
        { count: user.statistic?.photo, key: 'photos', link: `/users/${user.id}/photos` },
        { count: user.statistic?.visited, key: 'visited', link: `/users/${user.id}/visited` }
    ]

    return (
        <section className={styles.welcome}>
            <Link
                href={`/users/${user.id}`}
                className={styles.avatar}
                aria-label={user.name}
            >
                <Image
                    src={user.avatar ? `${IMG_HOST}${user.avatar}` : defaultAvatar.src}
                    alt={''}
                    width={96}
                    height={96}
                    priority={true}
                />
            </Link>

            <div className={styles.text}>
                <h1 className={styles.title}>{t('home-welcome-title', { name: firstName })}</h1>

                {!!facts.length && <p className={styles.facts}>{facts.join(' · ')}</p>}

                {level !== undefined && (
                    <div className={styles.progress}>
                        <LevelBadge
                            level={level}
                            size={26}
                            showTooltip={true}
                        />
                        <div className={styles.bar}>
                            <Progress
                                height={6}
                                value={nextLevelPercentage(experience, nextLevel)}
                            />
                            <span className={styles.experience}>
                                {t('home-welcome-experience', {
                                    experience: formatThousands(experience),
                                    next: formatThousands(nextLevel)
                                })}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {user.statistic && (
                <nav
                    className={styles.counters}
                    aria-label={t('home-welcome-counters')}
                >
                    {counters.map(({ key, count, link }) => (
                        <Link
                            key={key}
                            href={link}
                            className={styles.counter}
                        >
                            <b>{formatThousands(count ?? 0)}</b>
                            <span>{t(`home-welcome-${key}`, { count: count ?? 0 })}</span>
                        </Link>
                    ))}
                </nav>
            )}
        </section>
    )
}
