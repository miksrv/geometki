import React from 'react'

import Image from 'next/image'

import packageInfo from '@/package.json'
import { update } from '@/update'
import { formatDate } from '@/utils/helpers'

import styles from './styles.module.sass'

export const Footer: React.FC = () => (
    <footer className={styles.footer}>
        <div>
            {'Copyright ©'}
            <a
                href={'https://miksoft.pro'}
                className={styles.link}
                title={''}
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
        </div>
        <div>
            {'v'} <span>{packageInfo.version}</span> <span>({formatDate(update, 'DD.MM.YYYY, HH:mm')})</span>
        </div>
    </footer>
)
