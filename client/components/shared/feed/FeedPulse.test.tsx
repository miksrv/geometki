import React from 'react'

import { render, screen } from '@testing-library/react'

import { ApiType } from '@/api'

import { FeedPulse } from './FeedPulse'

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        i18n: { language: 'ru' },
        t: (key: string, opts?: Record<string, unknown>) =>
            opts?.count !== undefined ? `${key}:${String(opts.count)}` : key
    })
}))

jest.mock('@/utils/helpers', () => ({
    formatDate: () => '13 октября 2026',
    timeAgo: () => '5 минут назад'
}))

jest.mock('@/components/shared/user-avatar-group', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    UserAvatarGroup: ({ users }: any) => <div data-testid={'avatars'}>{users.length}</div>
}))

const pulse: ApiType.Feed.PulseResponse = {
    authors: 12,
    collections: 0,
    comments: 4,
    edits: 9,
    period: 7,
    photos: 40,
    places: 3,
    ratings: 0,
    updated: { date: '2026-10-13 10:00:00', timezone: 'UTC', timezone_type: 3 },
    users: [
        { id: 'u1', name: 'Мария' },
        { id: 'u2', name: 'Иван' }
    ],
    visits: 0
}

describe('FeedPulse', () => {
    it('renders nothing without data', () => {
        const { container } = render(<FeedPulse />)
        expect(container).toBeEmptyDOMElement()
    })

    it('shows the period, the non-zero counts, the people and the last event', () => {
        render(<FeedPulse pulse={pulse} />)

        expect(screen.getByText('feed-pulse-week')).toBeInTheDocument()
        expect(screen.getByText('40')).toBeInTheDocument()
        expect(screen.getByText('feed-pulse-photos:40')).toBeInTheDocument()
        expect(screen.queryByText('feed-pulse-ratings:0')).toBeNull()
        expect(screen.getByTestId('avatars')).toHaveTextContent('2')
        expect(screen.getByText('feed-pulse-authors:12')).toBeInTheDocument()
        expect(screen.getByText('feed-pulse-updated')).toBeInTheDocument()
    })

    it('says "month" when the week was quiet', () => {
        render(<FeedPulse pulse={{ ...pulse, period: 30 }} />)
        expect(screen.getByText('feed-pulse-month')).toBeInTheDocument()
    })

    it('fits the first three counts into one line in compact mode', () => {
        render(
            <FeedPulse
                pulse={pulse}
                compact={true}
            />
        )

        expect(
            screen.getByText(
                'feed-pulse-week: 3 feed-pulse-places:3 · 40 feed-pulse-photos:40 · 4 feed-pulse-comments:4'
            )
        ).toBeInTheDocument()
        expect(screen.queryByTestId('avatars')).toBeNull()
    })
})
