import React from 'react'

import Image from 'next/image'

import packageInfo from '@/package.json'
import { update } from '@/update'
import { formatDate } from '@/utils/helpers'

import { LanguageSwitcher } from '../language-switcher'
import { ThemeSwitcher } from '../theme-switcher'

import styles from './styles.module.sass'

export const Footer: React.FC = () => (
    <footer className={styles.footer}>
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
                    <span>{packageInfo.version}</span> <span>{`(${formatDate(update, 'DD.MM.YYYY, HH:mm')})`}</span>
                </span>
            </div>

            <div className={styles.switchers}>
                <ThemeSwitcher />
                <LanguageSwitcher />
            </div>
        </div>
    </footer>
)
