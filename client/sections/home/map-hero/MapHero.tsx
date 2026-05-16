import React from 'react'
import { Button, Icon } from 'simple-react-ui-kit'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel, ApiType } from '@/api'
import { IMG_HOST } from '@/config/env'

import styles from './styles.module.sass'

interface MapHeroProps {
    stats?: ApiType.Stats.GetResponse
    places?: ApiModel.Place[]
}

type StatKey = keyof ApiType.Stats.GetResponse

const STAT_ITEMS: Array<{ icon: string; key: StatKey; labelKey: string }> = [
    { icon: 'Point', key: 'places', labelKey: 'hero-stat-places' },
    { icon: 'Users', key: 'users', labelKey: 'hero-stat-users' },
    { icon: 'Camera', key: 'photos', labelKey: 'hero-stat-photos' },
    { icon: 'StarEmpty', key: 'reviews', labelKey: 'hero-stat-reviews' }
]

const formatNumber = (n: number): string => n.toLocaleString('ru-RU')

export const MapHero: React.FC<MapHeroProps> = ({ stats, places }) => {
    const { t } = useTranslation()

    const pins = places?.filter((p) => p.cover).slice(0, 6) ?? []

    return (
        <section className={styles.hero}>
            <Image
                src={'/images/pages/map-hero.jpg'}
                alt={'map'}
                fill
                priority
                className={styles.heroImage}
                sizes={'100vw'}
            />
            <div className={styles.heroOverlay} />

            <div className={styles.heroBody}>
                <div className={styles.heroLeft}>
                    <h1 className={styles.heroTitle}>{t('hero-title')}</h1>
                    <p className={styles.heroSubtitle}>{t('hero-subtitle')}</p>

                    <div className={styles.heroActions}>
                        <Button
                            mode={'primary'}
                            size={'large'}
                            link={'/places/create'}
                        >
                            {t('hero-cta-add')}
                            <Icon name={'PlusCircle'} />
                        </Button>
                        <Button
                            mode={'secondary'}
                            size={'large'}
                            link={'/map'}
                            className={styles.btnGhost}
                        >
                            {t('hero-cta-explore')}
                            <Icon name={'Compass'} />
                        </Button>
                    </div>
                </div>

                {!!pins.length && (
                    <div
                        className={styles.heroPins}
                        aria-hidden={'true'}
                    >
                        {pins.map((place) => (
                            <Link
                                key={place.id}
                                href={`/places/${place.id}`}
                                className={styles.pin}
                                title={place.title}
                            >
                                <Image
                                    src={`${IMG_HOST}${place.cover!.preview}`}
                                    alt={place.title}
                                    fill
                                    sizes={'80px'}
                                    className={styles.pinImage}
                                />
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            <div className={styles.heroStats}>
                {STAT_ITEMS.map(({ icon, key, labelKey }, i) => (
                    <React.Fragment key={key}>
                        <div className={styles.statItem}>
                            <div className={styles.statIcon}>
                                <Icon name={icon as Parameters<typeof Icon>[0]['name']} />
                            </div>
                            <div className={styles.statText}>
                                <span className={styles.statValue}>{stats ? formatNumber(stats[key]) : '—'}</span>
                                <span className={styles.statLabel}>{t(labelKey)}</span>
                            </div>
                        </div>
                        {i < STAT_ITEMS.length - 1 && <div className={styles.statDivider} />}
                    </React.Fragment>
                ))}
            </div>
        </section>
    )
}
