import React from 'react'
import { Button } from 'simple-react-ui-kit'

import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { generateNextSeo } from 'next-seo/pages'

import { AdminLayout } from '@/components/layout/admin-layout'
import { BreadcrumbLink } from '@/components/ui'
import { ADMIN_HREF } from '@/utils/admin'

import { EmptyState } from '../empty-state'
import { PageHeader } from '../page-header'

export { ADMIN_HREF }

export interface AdminSection {
    title: string
    href: string
}

export interface AdminPageShellProps {
    title: string
    /**
     * The section a nested page belongs to (a season's form under "Игровые сезоны"): the one
     * crumb above the title. A section's own page and the dashboard have none — the navigation
     * already says where one is
     */
    section?: AdminSection
    /** How many things the list holds, on the title's baseline: "48" */
    count?: string
    /** The title line's buttons (`small`): the page's one primary action, "Создать сезон" */
    actions?: React.ReactNode
    /** A list page: one viewport high on desktop, only the table scrolls (`AdminLayout fit`) */
    fit?: boolean
    /** The thing asked for is not there (a wrong id): the empty state with a link back */
    notFound?: boolean
    /** The thing could not be loaded: the empty state with a link back */
    error?: boolean
    children?: React.ReactNode
}

/**
 * The frame of every admin page (ADMIN-UI.md): the admin's own layout with the side navigation,
 * a `noindex` head, the `PageHeader` (a nested page has the crumb of its section), then the
 * content — or, when it is missing or failed, a state that leads back. While the content loads,
 * the page shows it disabled (a form with every field off, a table of skeletons), never a spinner.
 */
export const AdminPageShell: React.FC<AdminPageShellProps> = ({
    title,
    section,
    count,
    actions,
    fit,
    notFound,
    error,
    children
}) => {
    const { t, i18n } = useTranslation()

    const breadcrumbs: BreadcrumbLink[] | undefined = section
        ? [{ link: section.href, text: section.title }]
        : undefined
    const backHref = section?.href ?? ADMIN_HREF

    const state = notFound ? 'not-found' : error ? 'error' : undefined

    return (
        <AdminLayout fit={fit}>
            <Head>
                {generateNextSeo({
                    title: `${title} — ${t('admin-title')}`,
                    noindex: true,
                    openGraph: { locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US', title }
                })}
            </Head>

            <PageHeader
                title={title}
                count={count}
                breadcrumbs={breadcrumbs}
                actions={actions}
            />

            {state ? (
                <EmptyState
                    title={t(`admin-state-${state}`)}
                    description={t(`admin-state-${state}-description`)}
                    action={
                        <Button
                            mode={'secondary'}
                            size={'medium'}
                            link={backHref}
                            label={t('admin-state-back')}
                        />
                    }
                />
            ) : (
                children
            )}
        </AdminLayout>
    )
}
