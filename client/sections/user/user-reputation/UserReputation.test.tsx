import React from 'react'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

import { render, screen } from '@testing-library/react'

import { ApiType } from '@/api'

import { formatPoints, groupByMonth, UserReputation } from './UserReputation'

dayjs.extend(utc)

let mockQuery: Record<string, unknown> = {}

jest.mock('@/api', () => ({
    API: { useUsersGetReputationInfiniteQuery: () => mockQuery }
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        i18n: { language: 'ru' },
        t: (key: string, options?: Record<string, unknown>) =>
            options?.stars
                ? `${key}:${String(options.stars)}`
                : options?.count
                  ? `${key}:${String(options.count)}`
                  : key
    })
}))

jest.mock('@/utils/categories', () => ({ categoryImage: () => ({ src: '/images/poi/cave.png' }) }))

jest.mock('@/hooks/useInfiniteScroll', () => ({ useInfiniteScroll: () => () => undefined }))

jest.mock('@/components/shared', () => ({
    EmptyState: ({ title }: { title: string }) => <p>{title}</p>,
    ScoreStars: ({ value }: { value: number }) => (
        <span
            role={'img'}
            aria-label={`stars:${value}`}
        />
    ),
    Section: ({ title, children }: { title: React.ReactNode; children: React.ReactNode }) => (
        <section>
            <h2>{title}</h2>
            {children}
        </section>
    )
}))

const item = (id: string, date: string, points: number, extra: Partial<ApiType.Users.ReputationItem> = {}) =>
    ({
        created: { date: `${date} 10:00:00` },
        id,
        place: { id: `place-${id}`, slug: id, title: `Место ${id}` },
        points,
        role: 'author',
        stars: points > 0 ? 5 : 1,
        ...extra
    }) as ApiType.Users.ReputationItem

const items = [
    item('r3', '2026-11-03', 1),
    item('r2', '2026-11-01', -0.5, { role: 'contributor' }),
    item('r1', '2026-10-01', 2)
]

describe('UserReputation', () => {
    beforeEach(() => {
        mockQuery = {
            data: { pages: [{ count: 3, items, next: null, reputation: 3 }] },
            hasNextPage: false,
            isError: false,
            isFetching: false,
            isLoading: false
        }
    })

    it('lists the scores by month, each with its share, the stars and why', () => {
        render(<UserReputation userId={'u1'} />)

        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('reputation-history-count:3')
        expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2)
        expect(screen.getAllByRole('listitem')).toHaveLength(3)
        expect(screen.getByRole('link', { name: 'Место r3' })).toBeInTheDocument()
        expect(screen.getByText('−0,5')).toBeInTheDocument()
        expect(screen.getByText('reputation-history-contributor')).toBeInTheDocument()
        expect(screen.getByRole('img', { name: 'stars:1' })).toBeInTheDocument()
        // November's sum in its heading
        expect(screen.getAllByRole('heading', { level: 3 })[0]).toHaveTextContent('+0,5')
        expect(screen.queryByText('reputation-hint')).not.toBeInTheDocument()
    })

    it('shows skeleton rows, not a spinner, while the first page loads', () => {
        mockQuery = { isLoading: true }

        render(<UserReputation userId={'u1'} />)

        expect(screen.getByTestId('reputation-loader')).toBeInTheDocument()
        expect(screen.queryByText('reputation-history-empty-title')).not.toBeInTheDocument()
    })

    it('says so when nobody scored yet', () => {
        mockQuery = { data: { pages: [{ count: 0, items: [], next: null, reputation: 0 }] }, isLoading: false }

        render(<UserReputation userId={'u1'} />)

        expect(screen.getByText('reputation-history-empty-title')).toBeInTheDocument()
        expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
    })

    it('groups by month in order and sums each', () => {
        expect(groupByMonth(items).map(({ month, points }) => [month, points])).toStrictEqual([
            ['2026-11', 0.5],
            ['2026-10', 2]
        ])
    })

    it('formats a share with its sign', () => {
        expect(formatPoints(2, 'ru')).toBe('+2')
        expect(formatPoints(-0.33, 'ru')).toBe('−0,33')
        expect(formatPoints(1.5, 'en')).toBe('+1.5')
    })

    it('offers a retry, not "no scores yet", when the first page failed', () => {
        mockQuery = { isError: true, isLoading: false, refetch: jest.fn() }

        render(<UserReputation userId={'u1'} />)

        expect(screen.queryByText('reputation-history-empty-title')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'feed-retry' })).toBeInTheDocument()
    })

    it('gives the last month its sum only once its scores are all loaded', () => {
        mockQuery = { ...mockQuery, hasNextPage: true }

        render(<UserReputation userId={'u1'} />)

        const [november, october] = screen.getAllByRole('heading', { level: 3 })

        expect(november).toHaveTextContent('+0,5')
        expect(october).not.toHaveTextContent('+2')
    })
})
