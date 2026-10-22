'use client'

import React from 'react'

import Image from 'next/image'
import Link from 'next/link'

import { ErrorPageTexts } from './texts'

import styles from '@/styles/error-page.module.sass'

interface ErrorPageProps {
    /** The status shown big over the title: 404, 500 */
    code: number
    texts: ErrorPageTexts
    /** The illustration, none when not given */
    image?: string
    /** The App Router has no i18n routing, its Link does not add the /en prefix by itself */
    homeHref?: string
    /** The main button (`texts.action`): back on a 404, try again on a 500 */
    onAction?: () => void
}

/** A whole-screen page of an error: the code, what happened, a way on */
export const ErrorPage: React.FC<ErrorPageProps> = ({ code, texts, image, homeHref = '/', onAction }) => (
    <div className={styles.page}>
        <p className={styles.code}>{code}</p>
        <h1 className={styles.title}>{texts.title}</h1>
        <p className={styles.description}>{texts.description}</p>

        {image && (
            <div className={styles.image}>
                <Image
                    src={image}
                    alt={texts.imageAlt}
                    width={340}
                    height={300}
                    priority
                />
            </div>
        )}

        <div className={styles.actions}>
            {onAction && (
                <button
                    className={styles.actionButton}
                    onClick={onAction}
                >
                    {texts.action}
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
