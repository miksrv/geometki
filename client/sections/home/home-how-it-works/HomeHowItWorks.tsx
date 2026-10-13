import React from 'react'
import { Icon } from 'simple-react-ui-kit'

import Image from 'next/image'
import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'
import { LevelBadge, Section } from '@/components/shared'
import { categoryImage } from '@/utils/categories'

import styles from './styles.module.sass'

/** Experience per action, as the server counts it (server/app/Config/Constants.php, MODIFIER_*) */
const XP_PHOTO = 10
const XP_PLACE = 20

const ICONS_COUNT = 5

interface HomeHowItWorksProps {
    /** The fullest categories make the picture of the first step */
    categories?: ApiType.Stats.CategoryCount[]
}

/**
 * For a guest: how a site that its visitors fill works, and what a member gets from it.
 * Every step has a picture made of the real pieces of the site — category icons, the
 * "I was here" button, level badges — and the experience it brings, as the server counts it.
 */
export const HomeHowItWorks: React.FC<HomeHowItWorksProps> = ({ categories }) => {
    const { t } = useTranslation()

    const steps = [
        {
            key: 'find',
            picture: (
                <div className={styles.icons}>
                    {categories?.slice(0, ICONS_COUNT).map(({ name }) => (
                        <Image
                            key={name}
                            src={categoryImage(name)}
                            alt={''}
                            width={40}
                            height={40}
                        />
                    ))}
                </div>
            )
        },
        {
            key: 'visit',
            picture: (
                <>
                    <span className={styles.wasHere}>
                        <Icon name={'CheckCircle'} />
                        {t('visited-was-here')}
                    </span>
                    <span className={styles.xp}>{t('home-how-xp-photo', { xp: XP_PHOTO })}</span>
                </>
            )
        },
        {
            key: 'share',
            picture: (
                <>
                    <span className={styles.levels}>
                        <LevelBadge
                            level={2}
                            size={32}
                        />
                        <span className={styles.arrow}>
                            <Icon name={'KeyboardRight'} />
                        </span>
                        <LevelBadge
                            level={5}
                            size={40}
                        />
                        <span className={styles.arrow}>
                            <Icon name={'KeyboardRight'} />
                        </span>
                        <LevelBadge
                            level={10}
                            size={48}
                        />
                    </span>
                    <span className={styles.xp}>{t('home-how-xp-place', { xp: XP_PLACE })}</span>
                </>
            )
        }
    ]

    return (
        <Section title={t('home-how-title')}>
            <p className={styles.lede}>{t('home-how-lede')}</p>
            <ol className={styles.steps}>
                {steps.map(({ key, picture }, index) => (
                    <li
                        key={key}
                        className={styles.step}
                    >
                        <div
                            className={styles.picture}
                            aria-hidden={true}
                        >
                            {picture}
                        </div>
                        <div className={styles.body}>
                            <span className={styles.number}>{t('home-how-step', { number: index + 1 })}</span>
                            <h3>{t(`home-how-${key}-title`)}</h3>
                            <p>{t(`home-how-${key}-text`)}</p>
                        </div>
                    </li>
                ))}
            </ol>
        </Section>
    )
}
