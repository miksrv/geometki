import React from 'react'
import { cn } from 'simple-react-ui-kit'

import Link from 'next/link'

import styles from './styles.module.sass'

export type BreadcrumbLink = {
    link: string
    text: string
}

export interface BreadcrumbsProps {
    /** Path to the parent of the current page: section first, no home, no current page */
    links?: BreadcrumbLink[]
    className?: string
}

/**
 * Breadcrumb trail. Shown only on nested pages (see DESIGN.md): the trail starts at the
 * site section (the logo is the way home) and stops at the parent — the current page is
 * already the heading next to it. Renders nothing without links.
 */
export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ links, className }) =>
    links?.length ? (
        <nav aria-label={'breadcrumb'}>
            <ul className={cn(className, styles.breadcrumbs)}>
                {links.map(({ link, text }) => (
                    <li key={link}>
                        <Link
                            href={link}
                            title={text}
                        >
                            {text}
                        </Link>
                    </li>
                ))}
            </ul>
        </nav>
    ) : null
