import React from 'react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import utc from 'dayjs/plugin/utc'

import { screen, within } from '@testing-library/react'

import { makeTestStore, renderWithStore } from '@/__mocks__/commonMocks'

import { AdminPage } from './AdminPage'

dayjs.extend(utc)
dayjs.extend(relativeTime)

type Result = { data?: unknown; isLoading?: boolean; isError?: boolean }

const results: Record<string, Result> = {}

jest.mock('@/api', () => ({
    API: {
        useGetAchievementsManageQuery: () => results.achievements,
        useMailGetQueueQuery: () => results.mail,
        useMailingsGetListQuery: () => results.mailings
    }
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        i18n: { language: 'ru' },
        t: (key: string, options?: Record<string, unknown>) =>
            options?.title
                ? `${key}:${String(options.title)}`
                : options?.time
                  ? `${key}:${String(options.time)}`
                  : options?.count !== undefined
                    ? `${key}:${String(options.count)}`
                    : key
    })
}))

jest.mock('simple-react-ui-kit', () => ({
    Badge: ({ label }: { label: string }) => <span>{label}</span>,
    Button: ({ label, link }: { label: string; link?: string }) =>
        link ? <a href={link}>{label}</a> : <button>{label}</button>,
    cn: (...args: Array<string | undefined | false>) => args.filter(Boolean).join(' '),
    Icon: () => null,
    Skeleton: ({ className }: { className?: string }) => (
        <div
            data-testid={'skeleton'}
            className={className}
        />
    )
}))

jest.mock('@/components/shared/photo-lightbox', () => ({ PhotoLightbox: () => null }))

jest.mock('@/components/shared/admin-page-shell', () => ({
    ADMIN_HREF: '/admin',
    AdminPageShell: ({ title, children }: { title: string; children: React.ReactNode }) => (
        <div>
            <h1>{title}</h1>
            {children}
        </div>
    )
}))

const render = () => renderWithStore(<AdminPage />, { store: makeTestStore({ auth: { isAuth: true } }) })

/** A moment `minutes` ago as the API sends it: UTC, `Y-m-d H:i:s` */
const utcAgo = (minutes: number) => new Date(Date.now() - minutes * 60000).toISOString().slice(0, 19).replace('T', ' ')

const queue = (extra: Record<string, unknown> = {}) => ({
    data: { errors_week: 0, last_run_at: utcAgo(1), overdue: 0, pending: 3, sent_day: 9, ...extra }
})

const loaded = () => {
    results.achievements = {
        data: {
            data: [
                { id: 'a', is_active: true, type: 'base' },
                { id: 'b', is_active: false, type: 'base' },
                { id: 'c', is_active: false, type: 'base' }
            ]
        }
    }
    results.mail = queue()
    results.mailings = {
        data: { count: 5, items: [], stats: { canceled: 0, completed: 3, draft: 2, sending: 1, total: 6 } }
    }
}

const attention = () => screen.getByRole('region', { name: 'admin-attention-title' })

describe('AdminPage', () => {
    it('shows a card per section whose facts lead into the filtered lists', () => {
        loaded()
        render()

        expect(screen.getByRole('heading', { name: 'admin-overview' })).toBeInTheDocument()

        const achievements = within(screen.getByRole('region', { name: 'achievements-admin-title' }))
        expect(achievements.getByRole('link', { name: '2' })).toHaveAttribute('href', '/admin/achievements?state=off')

        const mailings = within(screen.getByRole('region', { name: 'admin-mailings-title' }))
        expect(mailings.getByRole('link', { name: '2' })).toHaveAttribute('href', '/admin/mailings?status=draft')
        expect(mailings.getByRole('link', { name: 'admin-mailing-create' })).toHaveAttribute(
            'href',
            '/admin/mailings/create'
        )

        // The mail has no page: a plain title and plain numbers
        const mail = within(screen.getByRole('region', { name: 'admin-mail-title' }))
        expect(mail.queryByRole('link')).not.toBeInTheDocument()
        expect(mail.getByText('9')).toBeInTheDocument()
        expect(mail.getByText('3')).toBeInTheDocument()
    })

    it('is calm when nothing needs attention: old errors of the log are not a reason to worry', () => {
        loaded()
        render()

        expect(within(attention()).getByText('admin-attention-empty')).toBeInTheDocument()
        expect(within(attention()).queryByRole('link')).not.toBeInTheDocument()
    })

    it('is not calm when the facts behind the attention failed to load', () => {
        loaded()
        results.mail = { isError: true }
        render()

        expect(within(attention()).queryByText('admin-attention-empty')).not.toBeInTheDocument()
        expect(within(attention()).getByText('admin-widget-error')).toBeInTheDocument()
    })

    it('lists what needs attention, the broken first', () => {
        loaded()
        results.mail = queue({ errors_week: 4, overdue: 2 })
        render()

        const items = within(attention()).getAllByRole('listitem')

        expect(items.map((item) => item.textContent)).toEqual([
            expect.stringContaining('admin-attention-mail-overdue:2'),
            expect.stringContaining('admin-attention-mail-errors:4')
        ])
        // The mail is fixed on the server: no link
        expect(within(items[0]).queryByRole('link')).not.toBeInTheDocument()
        expect(within(items[1]).queryByRole('link')).not.toBeInTheDocument()
    })

    it('says the emails do not go out when the sending job stopped or was never seen', () => {
        loaded()
        results.mail = queue({ last_run_at: utcAgo(60) })
        const { unmount } = render()

        expect(within(attention()).getByText(/^admin-attention-mail-job-late:/)).toBeInTheDocument()
        unmount()

        results.mail = queue({ last_run_at: null })
        render()

        expect(within(attention()).getByText('admin-attention-mail-job-unknown')).toBeInTheDocument()
        expect(screen.getByText('admin-widget-mail-job-unknown')).toBeInTheDocument()
    })

    it('shows skeletons while loading and a quiet line on an error, without failing the page', () => {
        results.achievements = { isError: true }
        results.mail = { isLoading: true }
        render()

        expect(screen.getByRole('heading', { name: 'admin-overview' })).toBeInTheDocument()
        expect(screen.getByText('admin-widget-error')).toBeInTheDocument()
        expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0)
    })
})
