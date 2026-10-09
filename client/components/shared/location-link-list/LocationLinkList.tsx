import React from 'react'
import { Container } from 'simple-react-ui-kit'

import Link from 'next/link'

import styles from './styles.module.sass'

export interface LocationLinkListItem {
    key: string
    href: string
    title: string
    count?: number
}

interface LocationLinkListProps {
    title: string
    items: LocationLinkListItem[]
}

/**
 * A titled `Container` of link pills with an optional count — the landing pages'
 * perelinking blocks (features/20-location-seo-pages.md, "Шаблон страницы"): category
 * chips, child locations, "this category by region", "this category nearby". Renders
 * nothing without items.
 */
export const LocationLinkList: React.FC<LocationLinkListProps> = ({ title, items }) => {
    if (!items.length) {
        return null
    }

    return (
        <Container title={title}>
            <div className={styles.list}>
                {items.map((item) => (
                    <Link
                        key={item.key}
                        href={item.href}
                        className={styles.pill}
                    >
                        {item.title}
                        {item.count !== undefined && <span className={styles.count}>{item.count}</span>}
                    </Link>
                ))}
            </div>
        </Container>
    )
}
