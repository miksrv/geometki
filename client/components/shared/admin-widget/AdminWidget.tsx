import React, { useId } from 'react'
import { cn, Icon, IconTypes, Skeleton } from 'simple-react-ui-kit'

import Link from 'next/link'

import styles from './styles.module.sass'

export interface AdminFact {
    key: string
    label: string
    /** The value: a number, a name with a note; `—` when there is none */
    value: React.ReactNode
    /** Where the value is looked at: the list filtered by what the line counts */
    href?: string
    /** The value needs a look: red for something broken, orange for something to do */
    tone?: 'danger' | 'warning'
}

export interface AdminWidgetProps {
    /** The section's icon in front of the title */
    icon: IconTypes
    title: string
    /** The section's page: the title leads there */
    href: string
    /** The state of the section in a few lines, each leading to the list behind its number */
    facts?: AdminFact[]
    /** The facts are loading: skeleton lines stand in their place */
    loading?: boolean
    /** The facts could not be loaded: a quiet line, the card stays */
    error?: string
    /** The footer's action: a `small` button, the section's create action */
    footer?: React.ReactNode
    className?: string
    children?: React.ReactNode
}

const SKELETONS = 3

/**
 * A card of one admin section on the dashboard (ADMIN-UI.md → The dashboard): the head — the
 * section's icon and title as a link —, the facts of its state (label and value, the value a
 * link into the filtered list) and the footer with its create action. It never repeats the
 * list of the section or a public page; loading is skeleton lines and an error a quiet line:
 * the card never fails the page.
 */
export const AdminWidget: React.FC<AdminWidgetProps> = ({
    icon,
    title,
    href,
    facts,
    loading,
    error,
    footer,
    className,
    children
}) => {
    const titleId = useId()

    return (
        <section
            className={cn(styles.widget, className)}
            aria-labelledby={titleId}
        >
            <header className={styles.head}>
                <Icon
                    name={icon}
                    className={styles.icon}
                />
                <h2
                    id={titleId}
                    className={styles.title}
                >
                    <Link href={href}>{title}</Link>
                </h2>
            </header>

            <div className={styles.body}>
                {loading ? (
                    Array.from({ length: SKELETONS }, (_, index) => (
                        <Skeleton
                            key={index}
                            className={styles.skeleton}
                        />
                    ))
                ) : error ? (
                    <p className={styles.quiet}>{error}</p>
                ) : (
                    <>
                        {!!facts?.length && (
                            <dl className={styles.facts}>
                                {facts.map((fact) => (
                                    <div
                                        key={fact.key}
                                        className={styles.fact}
                                    >
                                        <dt>{fact.label}</dt>
                                        <dd className={fact.tone ? styles[fact.tone] : undefined}>
                                            {fact.href ? <Link href={fact.href}>{fact.value}</Link> : fact.value}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        )}
                        {children}
                    </>
                )}
            </div>

            {footer && <footer className={styles.footer}>{footer}</footer>}
        </section>
    )
}
