import React from 'react'
import { Provider } from 'react-redux'

import { configureStore } from '@reduxjs/toolkit'
import { fireEvent, render, screen } from '@testing-library/react'

import { ApiType } from '@/api'
import applicationReducer from '@/app/applicationSlice'
import authReducer from '@/app/authSlice'
import notificationReducer from '@/app/notificationSlice'

import { GameLeaders } from './GameLeaders'

jest.mock('@/utils/localstorage', () => ({ getItem: jest.fn(), removeItem: jest.fn(), setItem: jest.fn() }))
jest.mock('../../../next-i18next.config', () => ({ i18n: { defaultLocale: 'ru' } }))
jest.mock('cookies-next', () => ({ deleteCookie: jest.fn(), getCookie: jest.fn(), setCookie: jest.fn() }))

const mockQuery = jest.fn()

jest.mock('@/api', () => ({
    API: {
        useGameGetLeadersQuery: (...args: unknown[]) => mockQuery(...args)
    },
    ApiModel: {},
    ApiType: {}
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        i18n: { language: 'ru' },
        t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${Object.values(opts).join(',')}` : key)
    })
}))

jest.mock('next/link', () => {
    const Link = ({ href, title, className, children }: any) => (
        <a
            href={href}
            title={title}
            className={className}
        >
            {children}
        </a>
    )
    Link.displayName = 'Link'
    return Link
})

jest.mock('simple-react-ui-kit', () => ({
    Button: ({ label, onClick }: any) => <button onClick={onClick}>{label}</button>,
    Container: ({ title, children }: any) => (
        <section>
            {title && <h3>{title}</h3>}
            {children}
        </section>
    ),
    Skeleton: () => <span data-testid={'skeleton'} />,
    cn: (...args: unknown[]) => args.filter(Boolean).join(' ')
}))

jest.mock('@/components/ui', () => ({
    Chip: ({ label, selected, onClick }: any) => (
        <button
            aria-pressed={!!selected}
            onClick={onClick}
        >
            {label}
        </button>
    ),
    Pagination: ({ currentPage, onChangePage }: any) => (
        <nav>
            <button onClick={() => onChangePage(currentPage + 1)}>{'next page'}</button>
        </nav>
    ),
    OptionList: ({ groups, onSelect }: any) => (
        <div data-testid={'options'}>
            {groups.flatMap((group: any) =>
                group.items.map((item: any) => (
                    <button
                        key={item.key}
                        aria-pressed={!!item.selected}
                        onClick={() => onSelect(item.key)}
                    >
                        {[item.label, item.caption].filter(Boolean).join(' ')}
                    </button>
                ))
            )}
        </div>
    ),
    ScrollRail: ({ children }: any) => <div data-testid={'chips'}>{children}</div>
}))

jest.mock('../filter-panel', () => ({
    FilterPopout: ({ value, children }: any) => (
        <div data-testid={'location'}>
            <span data-testid={'location-value'}>{value}</span>
            {children(() => undefined)}
        </div>
    )
}))

jest.mock('../level-badge/LevelBadge', () => ({ LevelBadge: () => null }))
jest.mock('../user-avatar', () => ({ UserAvatar: () => null }))

const leader = (place: number, id: string, points: number): ApiType.Game.Leader => ({
    place,
    places: place,
    points,
    quests: 0,
    user: { id, name: `User ${id}` }
})

const answer: ApiType.Game.LeadersResponse = {
    count: 12,
    items: [leader(1, 'u1', 300), leader(2, 'u2', 200)],
    locations: [
        { id: 81, players: 9, points: 900, slug: 'orenburg-oblast', title: 'Оренбургская область', type: 'region' }
    ],
    me: { ahead: 20, place: 9, places: 2, players: 12, points: 50, quests: 0 }
}

const renderLeaders = (props: React.ComponentProps<typeof GameLeaders>, userId = 'u9') =>
    render(
        <Provider
            store={configureStore({
                preloadedState: { auth: { isAuth: true, user: { id: userId } } as never },
                reducer: { application: applicationReducer, auth: authReducer, notification: notificationReducer }
            })}
        >
            <GameLeaders {...props} />
        </Provider>
    )

describe('GameLeaders', () => {
    beforeEach(() => {
        mockQuery.mockReset()
        mockQuery.mockReturnValue({ data: undefined, isFetching: false })
    })

    it('shows the answer of the server render without asking, the own line under the top', () => {
        renderLeaders({ initial: answer, limit: 7 })

        expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({ limit: 7 }), { skip: true })
        expect(screen.getByRole('list', { name: 'game-leaders-title' }).querySelectorAll('li')).toHaveLength(2)
        expect(screen.getByRole('link', { name: 'User u1' })).toHaveAttribute('href', '/users/u1')
        expect(screen.getByText('game-places-confirmed:1')).toBeInTheDocument()
        // The visitor is below the lines shown: their own line stands under the list, the same line
        const own = screen.getByRole('list', { name: 'game-leaders-me' })

        expect(own.querySelector('li')).toHaveClass('own')
        expect(own).toHaveTextContent('9')
        expect(own).toHaveTextContent('game-places-confirmed:2')
        // A block shows only the top
        expect(screen.queryByText(/game-leaders-more/)).not.toBeInTheDocument()
    })

    it('highlights the own line in the list instead of repeating it under it', () => {
        renderLeaders({ initial: { ...answer, me: { ...answer.me!, place: 2 } } }, 'u2')

        expect(screen.getAllByRole('listitem')[1]).toHaveClass('own')
        expect(screen.queryByRole('list', { name: 'game-leaders-me' })).not.toBeInTheDocument()
    })

    it('asks for the rating of a location when its chip is chosen', () => {
        renderLeaders({ initial: answer })

        fireEvent.click(screen.getByRole('button', { name: 'Оренбургская область' }))

        expect(mockQuery).toHaveBeenLastCalledWith(expect.objectContaining({ id: 81, type: 'region' }), { skip: false })
        expect(screen.getByRole('button', { name: 'Оренбургская область' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: 'game-leaders-everywhere' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('loads more lines on a page of its own, and has no scope chips for one location', () => {
        renderLeaders({
            expandable: true,
            initial: answer,
            limit: 2,
            location: { id: 81, type: 'region' },
            season: '2026-cold'
        })

        expect(screen.queryByRole('button', { name: 'game-leaders-everywhere' })).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'game-leaders-more:2' }))

        expect(mockQuery).toHaveBeenLastCalledWith(
            { id: 81, limit: 4, season: '2026-cold', type: 'region' },
            { skip: false }
        )
    })

    it('shows skeleton rows while the first answer loads, and a line when nobody has played', () => {
        mockQuery.mockReturnValue({ data: undefined, isFetching: true })
        const { unmount } = renderLeaders({})

        expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0)
        unmount()

        mockQuery.mockReturnValue({ data: { count: 0, items: [], locations: [] }, isFetching: false })
        renderLeaders({})

        expect(screen.getByText('game-leaders-empty')).toBeInTheDocument()
    })

    it('as a table has page links: a page is asked for on a tap, the locations are a dropdown', () => {
        renderLeaders({ initial: answer, limit: 2, variant: 'table' })

        // The first page is the server render's
        expect(mockQuery).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 2, offset: undefined }), {
            skip: true
        })
        expect(screen.getByText(/^pagination-range/)).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'next page' }))

        expect(mockQuery).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 2, offset: 2 }), { skip: false })

        // The dropdown: everywhere, then the locations with their explorers; a choice starts from page 1
        // It is the first thing of the side column, outside the card of the lines
        expect(screen.getByRole('complementary')).toContainElement(screen.getByTestId('location'))
        expect(screen.queryByTestId('chips')).not.toBeInTheDocument()
        expect(screen.getByTestId('location-value')).toHaveTextContent('game-leaders-everywhere')

        const options = screen.getByTestId('options').querySelectorAll('button')

        expect(options[1]).toHaveTextContent('Оренбургская область game-season-players:9')
        fireEvent.click(options[1])

        expect(mockQuery).toHaveBeenLastCalledWith(
            expect.objectContaining({ id: 81, limit: 2, offset: undefined, type: 'region' }),
            { skip: false }
        )
    })

    it('as the top only keeps the visitor in the list: their line is the last one, without page links', () => {
        // Below the top: the last line of it is their own, with their place
        const { unmount } = renderLeaders({ initial: answer, limit: 2, topOnly: true, variant: 'table' })
        let rows = screen.getByRole('list', { name: 'game-leaders-title' }).querySelectorAll('li')

        expect(rows).toHaveLength(2)
        expect(rows[0]).toHaveTextContent('User u1')
        expect(rows[1]).toHaveTextContent('9')
        expect(rows[1]).toHaveTextContent('50')
        expect(screen.queryByText('User u2')).not.toBeInTheDocument()
        // Not set apart under the list, and no pages
        expect(screen.queryByRole('list', { name: 'game-leaders-me' })).not.toBeInTheDocument()
        expect(screen.queryByText(/^pagination-range/)).not.toBeInTheDocument()
        unmount()

        // Without geopoints: the same line, a dash for the place
        renderLeaders({ initial: { ...answer, me: undefined }, limit: 2, topOnly: true, variant: 'table' })
        rows = screen.getByRole('list', { name: 'game-leaders-title' }).querySelectorAll('li')

        expect(rows).toHaveLength(2)
        expect(rows[1]).toHaveTextContent('—')
        expect(rows[1]).toHaveTextContent('game-places-confirmed:0')
    })

    it('as the top only leaves the list as it is when the visitor is in it', () => {
        renderLeaders({ initial: answer, limit: 2, topOnly: true, variant: 'table' }, 'u2')

        const rows = screen.getByRole('list', { name: 'game-leaders-title' }).querySelectorAll('li')

        expect(rows).toHaveLength(2)
        expect(rows[1]).toHaveTextContent('User u2')
    })
})
