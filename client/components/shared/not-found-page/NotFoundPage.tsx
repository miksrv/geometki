'use client'

import React from 'react'

import Image from 'next/image'
import Link from 'next/link'

import { NotFoundTexts } from './texts'

import styles from '@/styles/not-found.module.sass'

interface NotFoundPageProps {
    texts: NotFoundTexts
    /** The App Router has no i18n routing, its Link does not add the /en prefix by itself */
    homeHref?: string
    onBack?: () => void
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ texts, homeHref = '/', onBack }) => (
    <div className={styles.page}>
        <p className={styles.code}>{'404'}</p>
        <h1 className={styles.title}>{texts.title}</h1>
        <p className={styles.description}>{texts.description}</p>

        <div className={styles.image}>
            <Image
                src={'/images/404.png'}
                alt={texts.imageAlt}
                width={340}
                height={300}
                priority
            />
        </div>

        <div className={styles.actions}>
            {onBack && (
                <button
                    className={styles.backButton}
                    onClick={onBack}
                >
                    {`← ${texts.back}`}
                </button>
            )}
            <Link
                href={homeHref}
                className={styles.homeLink}
            >
                {texts.homeLink}
            </Link>
        </div>
    </div>
)
