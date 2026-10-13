import React from 'react'
import { Icon } from 'simple-react-ui-kit'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'
import { Autocomplete } from '@/components/ui'
import useSiteSearch from '@/hooks/useSiteSearch'
import useUserLocation from '@/hooks/useUserLocation'
import { categoryImage, getCategoryShortTitle } from '@/utils/categories'
import { buildCategoryHref, formatThousands, getLandingFlags } from '@/utils/helpers'

import styles from './styles.module.sass'

/** Category chips under the search: the fullest categories, so every chip leads to a long list */
const HERO_CHIPS_COUNT = 3

interface HomeHeroProps {
    stats?: ApiType.Stats.GetResponse
    pulse?: ApiType.Feed.PulseResponse
}

/**
 * The guest's first screen: what the site is, the search as the main action, the way into
 * the fullest categories and the places nearby, and the live numbers of the site.
 */
export const HomeHero: React.FC<HomeHeroProps> = ({ stats, pulse }) => {
    const { t } = useTranslation()
    const router = useRouter()
    const search = useSiteSearch()
    const { request: requestLocation, loading: locating } = useUserLocation()

    const actions = pulse
        ? pulse.places + pulse.photos + pulse.comments + pulse.ratings + pulse.edits + pulse.visits + pulse.collections
        : 0

    const chips = stats?.categories?.slice(0, HERO_CHIPS_COUNT) ?? []

    const statItems: Array<{ value?: number; label: string }> = [
        { label: t('home-hero-stat-places'), value: stats?.places },
        { label: t('home-hero-stat-photos'), value: stats?.photos },
        { label: t('home-hero-stat-reviews'), value: stats?.reviews },
        { label: t('home-hero-stat-unexplored'), value: stats?.unexplored }
    ]

    const handleNearby = async () => {
        const location = await requestLocation()

        if (location) {
            await router.push(`/places?lat=${location.lat}&lon=${location.lon}&sort=distance&order=ASC`)
        }
    }

    return (
        <section className={styles.hero}>
            <Image
                src={'/images/pages/home-hero.jpg'}
                alt={''}
                fill
                priority
                className={styles.image}
                sizes={'(max-width: 1260px) 100vw, 1260px'}
            />
            <div className={styles.overlay} />

            <div className={styles.body}>
                {actions > 0 && pulse && (
                    <p className={styles.eyebrow}>
                        <span className={styles.liveDot} />
                        {t(pulse.period > 7 ? 'home-hero-pulse-month' : 'home-hero-pulse-week', {
                            count: actions,
                            value: formatThousands(actions)
                        })}
                    </p>
                )}

                <h1 className={styles.title}>{t('home-hero-title')}</h1>
                <p className={styles.lead}>{t('home-hero-lead')}</p>

                <div
                    className={styles.search}
                    role={'search'}
                >
                    <Autocomplete<ApiType.Search.Suggestion>
                        notFoundCaption={t('nothing-found', { defaultValue: 'Ничего не найдено' })}
                        placeholder={t('home-hero-search-placeholder')}
                        debounceDelay={300}
                        leftIcon={'Search'}
                        {...search}
                    />
                </div>

                <div className={styles.chips}>
                    {chips.map(({ name }) => (
                        <Link
                            key={name}
                            href={buildCategoryHref(name, getLandingFlags())}
                            className={styles.chip}
                        >
                            <Image
                                src={categoryImage(name)}
                                alt={''}
                                width={18}
                                height={18}
                            />
                            {getCategoryShortTitle(t, name)}
                        </Link>
                    ))}
                    <button
                        type={'button'}
                        className={styles.chip}
                        disabled={locating}
                        onClick={() => void handleNearby()}
                    >
                        <Icon name={'Position'} />
                        {t('home-nearby')}
                    </button>
                </div>
            </div>

            <dl className={styles.stats}>
                {statItems.map(({ value, label }) => (
                    <div
                        key={label}
                        className={styles.stat}
                    >
                        <dt>{label}</dt>
                        <dd>{value !== undefined ? formatThousands(value) : '—'}</dd>
                    </div>
                ))}
            </dl>
        </section>
    )
}
