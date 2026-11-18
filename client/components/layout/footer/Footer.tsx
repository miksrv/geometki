import React from 'react'
import { cn } from 'simple-react-ui-kit'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { APP_VERSION } from '@/config/env'
import { formatDate } from '@/utils/helpers'

import { LanguageSwitcher } from '../language-switcher'
import { ThemeSwitcher } from '../theme-switcher'

import styles from './styles.module.sass'

export const Footer: React.FC<{ className?: string }> = ({ className }) => {
    const { t } = useTranslation()

    return (
        <footer className={cn(styles.footer, className)}>
            <div className={styles.inner}>
                <div className={styles.copyright}>
                    <span>
                        {'Copyright ©'}
                        <a
                            href={'https://miksoft.pro'}
                            className={styles.link}
                            title={'MikSoft'}
                        >
                            <Image
                                className={styles.copyrightImage}
                                src={'https://miksoft.pro/favicon.ico'}
                                alt={''}
                                width={12}
                                height={12}
                            />
                            {'Mik'}
                        </a>
                        {formatDate(new Date(), 'YYYY')}
                    </span>
                    <span className={styles.version}>
                        {'v'}
                        <span>{APP_VERSION}</span>
                    </span>
                    <Link href={'/about'}>{t('about-title')}</Link>
                    <Link href={'/rules'}>{t('rules-title')}</Link>
                </div>

                <div className={styles.switchers}>
                    <ThemeSwitcher />
                    <LanguageSwitcher />
                </div>
            </div>
        </footer>
    )
}
