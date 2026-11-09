import React from 'react'
import { cn, Icon, IconTypes } from 'simple-react-ui-kit'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { IMG_HOST } from '@/config/env'
import useClientOnly from '@/hooks/useClientOnly'
import defaultAvatar from '@/public/images/no-avatar.png'
import { formatThousands, isOnlineAt, makeActiveLink, removeProtocolFromUrl, timeAgo } from '@/utils/helpers'
import { levelColor, levelProgress, levelTier } from '@/utils/levels'

import { LevelBadge } from '../level-badge/LevelBadge'

import styles from './styles.module.sass'

export type UserProfileCardVariant = 'home' | 'profile'

/** The pages of a profile, the links at the foot of the card: the overview, the lists of places, the achievements */
export type UserProfileSection = 'overview' | 'places' | 'achievements'

const SECTIONS: Array<{ key: UserProfileSection; icon: IconTypes; label: string; path: string }> = [
    { icon: 'User', key: 'overview', label: 'user-tab-overview', path: '' },
    { icon: 'Point', key: 'places', label: 'user-tab-places', path: '/places' },
    { icon: 'Award', key: 'achievements', label: 'achievements-title', path: '/achievements' }
]

export interface UserProfileCardProps {
    user: ApiModel.User
    /**
     * `home` — the signed-in home page: a greeting (a line of the card, not a page title), the
     * avatar and the name lead to the profile; `profile` — the head of the profile: the name is
     * the page's h1, the biggest avatar of the site, when they were last here and their website
     */
    variant?: UserProfileCardVariant
    /** The owner's buttons ("Сменить фото", "Настройки") under the level, left-aligned */
    actions?: React.ReactNode
    /**
     * `home`: the facts line under the greeting — what changes from day to day (the week's
     * actions, the run of days), never what stays the same (the year of sign-up)
     */
    facts?: React.ReactNode[]
    /** The avatar right after it was replaced, before the profile is fetched again */
    avatarSrc?: string
    /** `profile`: the page of the profile shown, underlined at the foot of the card */
    activeSection?: UserProfileSection
}

/**
 * The card of a person (DESIGN.md → Person): the square avatar, the title with one line of facts
 * and the level with the progress to the next one; the counters on the right — places, photos and
 * visited places, each a link to the "Места" tab, and the reputation, a link to its history. One component for the
 * signed-in home page and the profile, so the person reads the same in both.
 */
export const UserProfileCard: React.FC<UserProfileCardProps> = ({
    user,
    variant = 'profile',
    actions,
    facts,
    avatarSrc,
    activeSection
}) => {
    const { t, i18n } = useTranslation()
    // Both pages are cached: "online" and "5 minutes ago" are the browser's
    const isClient = useClientOnly()

    const isHome = variant === 'home'
    const profileHref = `/users/${user.id}`
    const level = user.levelData?.level
    const progress = levelProgress(user.levelData)
    // The year as the API writes it ("2014-11-12 11:36:18"), not shifted by the reader's time zone
    const since = user.created?.date ? Number(user.created.date.slice(0, 4)) || undefined : undefined
    const lastSeen = user.activity?.date ?? user.updated?.date
    const isOnline = isClient && isOnlineAt(user.activity?.date)
    const reputation = user.reputation ?? 0
    const avatar = avatarSrc || user.avatar
    const size = isHome ? 96 : 160

    const counters = [
        { count: user.statistic?.place ?? 0, key: 'places', link: `${profileHref}/places` },
        { count: user.statistic?.photo ?? 0, key: 'photos', link: `${profileHref}/photos` },
        { count: user.statistic?.visited ?? 0, key: 'visited', link: `${profileHref}/places?show=visited` }
    ]

    const image = (
        <Image
            className={styles.avatarImage}
            src={avatar ? `${IMG_HOST}${avatar}` : defaultAvatar.src}
            alt={isHome ? '' : user.name}
            width={size}
            height={size}
            priority={true}
        />
    )

    return (
        <section className={cn(styles.card, isHome ? styles.home : styles.profile)}>
            {isHome ? (
                <Link
                    href={profileHref}
                    className={cn(styles.avatar, styles.avatarLink)}
                    aria-label={t('user-card-open-profile')}
                    title={t('user-card-open-profile')}
                >
                    {image}
                </Link>
            ) : (
                <div className={styles.avatar}>{image}</div>
            )}

            <div className={styles.text}>
                <h1 className={styles.title}>
                    {isHome ? t('home-welcome-title', { name: user.name.split(' ')[0] }) : user.name}
                </h1>

                {/* The dots between the facts sit on the list items, outside the links */}
                <ul className={styles.facts}>
                    {/* Nothing before hydration: the cached HTML carries no time */}
                    {!isHome && isClient && (isOnline || lastSeen) && (
                        <li suppressHydrationWarning={true}>
                            {isOnline ? (
                                <span className={styles.online}>{t('user-hero-online')}</span>
                            ) : (
                                t('user-hero-last-seen', { time: timeAgo(lastSeen, undefined, i18n.language) })
                            )}
                        </li>
                    )}
                    {!isHome && !!since && <li>{t('user-hero-since', { year: since })}</li>}
                    {isHome && facts?.map((fact, index) => <li key={index}>{fact}</li>)}
                    {!isHome && !!user.website && (
                        <li>
                            <Link
                                href={makeActiveLink(user.website)}
                                className={styles.website}
                                target={'_blank'}
                                rel={'noopener noreferrer nofollow ugc'}
                                title={removeProtocolFromUrl(user.website)}
                            >
                                <Icon name={'Link'} />
                                <span>{removeProtocolFromUrl(user.website)}</span>
                            </Link>
                        </li>
                    )}
                </ul>

                {level !== undefined && (
                    <div className={styles.level}>
                        <LevelBadge
                            level={level}
                            size={isHome ? 28 : 32}
                            showTooltip={true}
                        />
                        <div className={styles.levelText}>
                            <div className={styles.levelRow}>
                                <span className={styles.tier}>
                                    {t('user-hero-level', { level })}
                                    {' · '}
                                    {t(`levelTier.${levelTier(level)}`)}
                                </span>
                                <span className={styles.experience}>
                                    {progress.isMaxLevel
                                        ? t('home-welcome-experience-max', {
                                              experience: formatThousands(user.levelData?.experience ?? 0)
                                          })
                                        : t('home-welcome-experience', {
                                              experience: formatThousands(progress.gained),
                                              next: formatThousands(progress.required ?? 0)
                                          })}
                                </span>
                            </div>
                            <div
                                className={styles.progressBar}
                                role={'progressbar'}
                                aria-label={t('user-hero-progress')}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={progress.percent}
                            >
                                <div
                                    className={styles.progressFill}
                                    style={{ backgroundColor: levelColor(level), width: `${progress.percent}%` }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {actions && <div className={styles.actions}>{actions}</div>}
            </div>

            {/* No statistic (the profile did not load): no counters, rather than zeros that lie */}
            {user.statistic && (
                <nav
                    className={styles.counters}
                    aria-label={t('user-hero-counters', { name: user.name })}
                >
                    {counters.map(({ key, count, link }) => (
                        <Link
                            key={key}
                            href={link}
                            className={styles.counter}
                        >
                            <b>{formatThousands(count)}</b>
                            <span>{t(`user-hero-${key}`, { count })}</span>
                        </Link>
                    ))}

                    {/* The history of the reputation: every score that moved it, and what it is made of */}
                    <Link
                        href={`${profileHref}/reputation`}
                        className={cn(styles.counter, styles.reputation)}
                        aria-label={`${t('reputation')}: ${reputation}`}
                    >
                        <b className={reputation > 0 ? styles.positive : reputation < 0 ? styles.negative : undefined}>
                            {reputation > 0 ? `+${formatThousands(reputation)}` : formatThousands(reputation)}
                        </b>
                        <span>{t('user-hero-reputation')}</span>
                    </Link>
                </nav>
            )}

            {/* The pages of the profile, attached to the foot of the card: the profile's tabs. The home
                card has none: the avatar and the counters already lead into the own profile */}
            {!isHome && (
                <nav
                    className={styles.sections}
                    aria-label={t('user-card-sections', { name: user.name })}
                >
                    {SECTIONS.map(({ key, icon, label, path }) => (
                        <Link
                            key={key}
                            href={`${profileHref}${path}`}
                            className={cn(styles.section, activeSection === key && styles.active)}
                            aria-current={activeSection === key ? 'page' : undefined}
                        >
                            <Icon name={icon} />
                            {t(label)}
                        </Link>
                    ))}
                </nav>
            )}
        </section>
    )
}
