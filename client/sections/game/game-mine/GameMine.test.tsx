import React from 'react'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

import { fireEvent, render, screen } from '@testing-library/react'

import type { ApiType } from '@/api'

import { GameMine } from './GameMine'

dayjs.extend(utc)

const mockQuery = jest.fn()

jest.mock('@/api', () => ({
    API: { useGameGetMineQuery: (...args: unknown[]) => mockQuery(...args) },
    ApiModel: {},
    ApiType: {}
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        i18n: { language: 'ru' },
        t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${Object.values(opts).join(',')}` : key)
    })
}))

interface MockPaginationProps {
    currentPage: number
    totalItemsCount: number
    perPage: number
    onChangePage: (page: number) => void
}

interface MockPlaceCardProps {
    place: { id: string; title: string; content?: string }
    variant?: string
    footer?: React.ReactNode
    actions?: React.ReactNode
}

jest.mock('@/components/shared', () => ({
    GamePoints: ({ value, plus }: { value: number; plus?: boolean }) => <span>{`${plus ? '+' : ''}${value}`}</span>,
    PaginationBar: ({ currentPage, totalItemsCount, perPage, onChangePage }: MockPaginationProps) =>
        totalItemsCount > perPage ? (
            <nav>
                <button onClick={() => onChangePage(currentPage + 1)}>{'next page'}</button>
            </nav>
        ) : null,
    PlaceCard: ({ place, variant, footer, actions }: MockPlaceCardProps) => (
        <article data-variant={variant}>
            <a href={`/places/${place.id}`}>{place.title}</a>
            <span data-testid={'excerpt'}>{place.content}</span>
            {footer}
            {actions}
        </article>
    ),
    Section: ({ title, children }: { title: string; children: React.ReactNode }) => (
        <section>
            <h2>{title}</h2>
            {children}
        </section>
    )
}))

const item = (id: string, points: number, way: 'geo' | 'photo'): ApiType.Game.MineItem => ({
    created: { date: '2026-11-10 12:00:00', timezone: 'UTC', timezone_type: 3 },
    id,
    place: {
        content: 'A long description',
        cover: { preview: 'cover.jpg' },
        id: `place-${id}`,
        title: `Place ${id}`
    } as ApiType.Game.MineItem['place'],
    points,
    way
})

const mine: ApiType.Game.MineResponse = {
    count: 300,
    items: [item('b', 45, 'photo'), item('a', 35, 'geo')],
    points: 80
}

describe('GameMine', () => {
    beforeEach(() => {
        mockQuery.mockReset()
        mockQuery.mockReturnValue({ data: undefined, isFetching: false })
    })

    it('is the chronicle of the season: the places counted, when, how and what each brought', () => {
        render(<GameMine initial={mine} />)

        // The server render's answer: no request
        expect(mockQuery).toHaveBeenCalledWith({ limit: 10, offset: undefined }, { skip: true })
        expect(screen.getByRole('heading', { name: 'game-mine-title' })).toBeInTheDocument()
        expect(screen.getByText('game-places-confirmed:300')).toBeInTheDocument()
        expect(screen.getByText('game-points:80')).toBeInTheDocument()

        const rows = screen.getAllByRole('listitem')

        expect(rows).toHaveLength(2)
        expect(rows[0]).toHaveTextContent('Place b')
        expect(rows[0]).toHaveTextContent('+45')
        expect(rows[0]).toHaveTextContent('game-mine-way-photo')
        // The site's list of places, as rows, without the excerpt of the description
        expect(rows[0].querySelector('article')).toHaveAttribute('data-variant', 'row')
        expect(screen.getAllByTestId('excerpt')[0]).toBeEmptyDOMElement()
        expect(screen.getByRole('link', { name: 'Place a' })).toHaveAttribute('href', '/places/place-a')
    })

    it('has page links: a page is asked for on a tap', () => {
        render(<GameMine initial={mine} />)

        fireEvent.click(screen.getByRole('button', { name: 'next page' }))

        expect(mockQuery).toHaveBeenLastCalledWith({ limit: 10, offset: 10 }, { skip: false })
    })

    it('has no page links when the season fits on a page', () => {
        render(<GameMine initial={{ ...mine, count: 2 }} />)

        expect(screen.queryByRole('button', { name: 'next page' })).not.toBeInTheDocument()
    })

    it('is not there without counted places', () => {
        const { container } = render(<GameMine initial={{ count: 0, items: [], points: 0 }} />)

        expect(container).toBeEmptyDOMElement()
    })
})
