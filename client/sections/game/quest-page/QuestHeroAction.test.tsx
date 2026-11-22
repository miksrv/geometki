import React from 'react'

import { fireEvent, screen } from '@testing-library/react'

import { makeTestStore, renderWithStore } from '@/__mocks__/commonMocks'
import { ApiType } from '@/api'

import { QuestHeroAction } from './QuestHeroAction'
import { QuestHowTo } from './QuestHowTo'

jest.mock('simple-react-ui-kit', () => ({
    Button: ({
        label,
        link,
        onClick,
        disabled
    }: {
        label: string
        link?: string
        onClick?: () => void
        disabled?: boolean
    }) =>
        link ? (
            <a href={link}>{label}</a>
        ) : (
            <button
                disabled={disabled}
                onClick={onClick}
            >
                {label}
            </button>
        ),
    Container: ({ title, children }: { title?: string; children?: React.ReactNode }) => (
        <section>
            <h2>{title}</h2>
            {children}
        </section>
    ),
    Icon: ({ name }: { name: string }) => <i data-testid={`icon-${name}`} />,
    cn: (...args: unknown[]) => args.filter(Boolean).join(' ')
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        i18n: { language: 'ru' },
        t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${Object.values(opts).join(',')}` : key)
    })
}))

jest.mock('@/utils/date', () => ({
    formatDate: (date?: string) => date?.slice(0, 10) ?? ''
}))

jest.mock('@/components/shared', () => ({
    Section: ({ title, children }: { title?: string; children?: React.ReactNode }) => (
        <section>
            <h2>{title}</h2>
            {children}
        </section>
    ),
    ConfirmationDialog: ({ open, message, onConfirm }: { open: boolean; message: string; onConfirm: () => void }) =>
        open ? (
            <div role={'dialog'}>
                {message}
                <button onClick={onConfirm}>confirm</button>
            </div>
        ) : null
}))

const quest = (walk: ApiType.Game.QuestWalk | null = null): ApiType.Game.QuestResponse =>
    ({
        bonus: 50,
        id: 'r1',
        items: [
            { id: 'p1', position: 1, state: walk ? 'done' : 'current' },
            {
                hint: 'Под куполом',
                id: 'p2',
                place: { id: 'pl2', lat: 51.77, lon: 55.1, title: 'Планетарий' },
                position: 2,
                state: walk ? 'current' : 'locked'
            }
        ],
        length: 1200,
        mode: 'steps',
        points: 2,
        status: 'published',
        title: 'Космический Оренбург',
        walk,
        walked: 0,
        walkers: []
    }) as unknown as ApiType.Game.QuestResponse

const guest = () => makeTestStore({ auth: { isAuth: false } })
const member = () => makeTestStore({ auth: { isAuth: true, user: { id: 'u1', name: 'Alice' } } })

const renderAction = (item: ApiType.Game.QuestResponse, store = member(), onLeave = jest.fn()) =>
    renderWithStore(
        <QuestHeroAction
            quest={item}
            onStart={jest.fn()}
            onLeave={onLeave}
        />,
        { store }
    )

const begun = () => quest({ confirmed: 1, finished: null, id: 'w1', started: '2026-11-11' })

describe('QuestHeroAction', () => {
    it('offers a guest to sign in', () => {
        renderAction(quest(), guest())

        expect(screen.getByRole('button', { name: 'game-quest-sign-in' })).toBeInTheDocument()
        expect(screen.getByText('game-quest-sign-in-note')).toBeInTheDocument()
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    })

    it('offers someone signed in to start, with nothing to give up yet', () => {
        renderAction(quest())

        expect(screen.getByRole('button', { name: 'game-quest-start' })).toBeInTheDocument()
        expect(screen.getByText('game-quest-start-note')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'game-quest-leave' })).not.toBeInTheDocument()
    })

    it('keeps "Начать квест" off with as many quests begun as can be, and says why', () => {
        renderAction({ ...quest(), activeWalks: { count: 10, max: 10 } })

        expect(screen.getByRole('button', { name: 'game-quest-start' })).toBeDisabled()
        expect(screen.getByText(/game-quest-start-limit/)).toBeInTheDocument()
        expect(screen.queryByText('game-quest-start-note')).not.toBeInTheDocument()
    })

    it('shows the progress of a walk begun in place of the button', () => {
        renderAction(begun())

        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
        expect(screen.queryByRole('button', { name: 'game-quest-start' })).not.toBeInTheDocument()
    })

    it('gives up a walk begun only after a confirmation', () => {
        const onLeave = jest.fn()

        renderAction(begun(), member(), onLeave)

        fireEvent.click(screen.getByRole('button', { name: 'game-quest-leave' }))
        expect(onLeave).not.toHaveBeenCalled()
        expect(screen.getByRole('dialog')).toHaveTextContent('game-quest-leave-confirm:Космический Оренбург')

        fireEvent.click(screen.getByRole('button', { name: 'confirm' }))
        expect(onLeave).toHaveBeenCalledTimes(1)
    })

    it('says a walked quest is walked, with the day, and offers nothing to press', () => {
        renderAction(quest({ confirmed: 2, finished: '2026-11-11', id: 'w1', started: '2026-11-10' }))

        expect(screen.getByText('game-quest-walked')).toBeInTheDocument()
        // The day it was walked and, in brackets, how long it took
        expect(screen.getByText('2026-11-11 (game-duration-days:1)')).toBeInTheDocument()
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
})

describe('QuestHowTo', () => {
    it('starts with signing in for a guest and tells the mechanics', () => {
        renderWithStore(
            <QuestHowTo
                quest={quest()}
                isGuest={true}
            />
        )

        expect(screen.getByText('game-quest-howto-lede')).toBeInTheDocument()
        const steps = screen.getAllByRole('listitem')

        expect(steps).toHaveLength(3)
        expect(steps[0]).toHaveTextContent('game-quest-howto-start-guest')
        expect(steps[1]).toHaveTextContent('game-quest-howto-go-steps')
        expect(steps[2]).toHaveTextContent('game-quest-howto-xp:50')
    })

    it('tells a walker of a riddle quest how its points are found', () => {
        renderWithStore(<QuestHowTo quest={{ ...quest(), mode: 'riddles' }} />)

        expect(screen.getAllByRole('listitem')[1]).toHaveTextContent('game-quest-howto-go-riddles')
    })
})
