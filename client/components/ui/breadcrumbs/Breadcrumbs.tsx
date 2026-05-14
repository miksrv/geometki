import React from 'react'
import { cn } from 'simple-react-ui-kit'

import Link from 'next/link'

import styles from './styles.module.sass'

export type BreadcrumbLink = {
    link: string
    text: string
}

export interface BreadcrumbsProps {
    homePageTitle?: string
    currentPage?: string
    className?: string
    links?: BreadcrumbLink[]
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ homePageTitle, links, className, currentPage }) => (
    <nav aria-label={'breadcrumb'}>
        <ul className={cn(className, styles.breadcrumbs)}>
            {!!homePageTitle?.length && (
                <li>
                    <Link
                        href={'/'}
                        title={homePageTitle}
                    >
                        {homePageTitle}
                    </Link>
                </li>
            )}

            {!!links?.length &&
                links.map(({ link, text }) => (
                    <li key={link}>
                        <Link
                            href={link}
                            title={text}
                        >
                            {text}
                        </Link>
                    </li>
                ))}

            {currentPage && <li>{currentPage}</li>}
        </ul>
    </nav>
)
