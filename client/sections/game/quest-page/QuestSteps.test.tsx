import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { ApiModel, ApiType } from '@/api'

import { QuestSteps } from './QuestSteps'

jest.mock('simple-react-ui-kit', () => ({
    Button: ({ label, link, onClick, disabled }: any) =>
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
    Icon: ({ name }: { name: string }) => <i data-testid={`icon-${name}`} />,
    cn: (...args: unknown[]) => args.filter(Boolean).join(' ')
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        i18n: { language: 'ru' },
        t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${Object.values(opts).join(',')}` : key)
    })
}))

// The day of a confirmation is formatted by dayjs with its utc plugin, set up by the app
jest.mock('@/utils/date', () => ({
    formatDate: (date?: string) => date?.slice(0, 10) ?? ''
}))

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ src }: { src: string }) => (
        <img
            src={src}
            alt={''}
        />
    )
}))

jest.mock('@/components/shared', () => ({
    PhotoLightbox: ({ photos }: { photos: Array<{ full: string }> }) => (
        <div role={'dialog'}>{photos.map((photo) => photo.full).join(',')}</div>
    ),
    GamePoints: ({ value }: { value: number }) => <span>{`+${value}`}</span>,
    PlaceCard: ({ place, footer }: { place: { id: string; title: string }; footer?: React.ReactNode }) => (
        <div data-testid={`place-${place.id}`}>
            {place.title}
            {footer}
        </div>
    )
}))

const place = (id: string, lat: number): ApiModel.PlaceListItem => ({ id, lat, lon: 55.1, title: `Место ${id}` })

const quest = (
    mode: ApiType.Game.QuestMode,
    items: ApiType.Game.QuestPoint[],
    walk: ApiType.Game.QuestWalk | null = null
): ApiType.Game.QuestResponse => ({
    bonus: 30,
    description: null,
    id: 'r1',
    slug: null,
    items,
    length: 1000,
    mode,
    points: items.length,
    status: 'published',
    title: 'Квест',
    walk,
    walked: 0,
    walkers: []
})

describe('QuestSteps', () => {
    it('shows a step quest as far as the walker has got: confirmed, the one to go to, the closed ones', () => {
        render(
            <QuestSteps
                quest={quest('steps', [
                    {
                        confirmedAt: '2026-11-11 10:00:00',
                        hint: 'У воды',
                        id: 'a',
                        place: place('p1', 51.75),
                        position: 1,
                        state: 'done'
                    },
                    { id: 'b', place: place('p2', 51.76), position: 2, state: 'current', value: 20 },
                    { id: 'c', position: 3, state: 'locked' }
                ])}
            />
        )

        expect(screen.getByTestId('place-p1')).toHaveTextContent('У воды')
        expect(screen.getByText(/game-quest-point-done/)).toBeInTheDocument()

        expect(screen.getByTestId('place-p2')).toBeInTheDocument()
        // No geopoints: a quest is no part of a season
        expect(screen.queryByText('+20')).not.toBeInTheDocument()
        // No distances between the points
        expect(screen.queryByText(/км|м$/)).not.toBeInTheDocument()

        // A closed point is a line of text, never a place
        expect(screen.getByText('game-quest-locked:2')).toBeInTheDocument()
        expect(screen.getAllByTestId(/^place-/)).toHaveLength(2)
        expect(screen.getByTestId('icon-Lock')).toBeInTheDocument()
        // A step quest is confirmed by the page's one button, not per point
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('shows the riddle of the current point instead of its place', () => {
        render(
            <QuestSteps
                quest={quest('riddles', [
                    { hint: 'Где падает вода', id: 'a', position: 1, state: 'current' },
                    { id: 'b', position: 2, state: 'locked' }
                ])}
            />
        )

        expect(screen.getByText('game-quest-riddle:1')).toBeInTheDocument()
        expect(screen.getByText('Где падает вода')).toBeInTheDocument()
        expect(screen.getByText('game-quest-locked-riddle')).toBeInTheDocument()
        expect(screen.queryByTestId(/^place-/)).not.toBeInTheDocument()
    })

    it('puts "Я на месте" under the riddle being solved once the walk is begun', () => {
        const onConfirm = jest.fn()

        render(
            <QuestSteps
                quest={quest(
                    'riddles',
                    [
                        { hint: 'Где падает вода', id: 'a', position: 1, state: 'current' },
                        { id: 'b', position: 2, state: 'locked' }
                    ],
                    { confirmed: 0, finished: null, id: 'w1', started: '2026-11-11' }
                )}
                onConfirm={onConfirm}
            />
        )

        expect(screen.getByText('Где падает вода')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'game-here-button' }))
        expect(onConfirm).toHaveBeenCalledWith()
        // The answer is a place: no way to it
        expect(screen.queryByRole('link', { name: 'game-quest-directions' })).not.toBeInTheDocument()
    })

    it('shows a riddle of a photo quest as the photo, enlarged on a tap, with no place', () => {
        render(
            <QuestSteps
                quest={quest(
                    'photos',
                    [
                        {
                            id: 'a',
                            photo: {
                                full: 'uploads/places/p1/a.jpg',
                                height: 600,
                                preview: 'uploads/places/p1/a_preview.jpg',
                                width: 800
                            },
                            position: 1,
                            state: 'current'
                        },
                        { id: 'b', position: 2, state: 'locked' }
                    ],
                    { confirmed: 0, finished: null, id: 'w1', started: '2026-11-11' }
                )}
                onConfirm={jest.fn()}
            />
        )

        expect(screen.getByText('game-quest-photo:1')).toBeInTheDocument()
        expect(screen.getByText('game-quest-locked-photo')).toBeInTheDocument()
        expect(screen.queryByTestId(/^place-/)).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'game-quest-photo-zoom' }))
        expect(screen.getByRole('dialog')).toHaveTextContent('uploads/places/p1/a.jpg')
    })

    it('gives the current point of a step quest begun "Я на месте" and the way there in a new tab', () => {
        const onConfirm = jest.fn()

        render(
            <QuestSteps
                quest={quest(
                    'steps',
                    [
                        {
                            confirmedAt: '2026-11-11 10:00:00',
                            id: 'a',
                            place: place('p1', 51.75),
                            position: 1,
                            state: 'done'
                        },
                        { id: 'b', place: place('p2', 51.76), position: 2, state: 'current' },
                        { id: 'c', position: 3, state: 'locked' }
                    ],
                    { confirmed: 1, finished: null, id: 'w1', started: '2026-11-11' }
                )}
                onConfirm={onConfirm}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: 'game-here-button' }))
        expect(onConfirm).toHaveBeenCalledWith()
        expect(screen.getByRole('link', { name: 'game-quest-directions' })).toHaveAttribute(
            'href',
            'https://yandex.ru/maps/?rtext=~51.76,55.1&rtt=pd'
        )
        expect(screen.getByRole('link', { name: 'game-quest-directions' })).toHaveAttribute('target', '_blank')
    })

    it('gives every point of an open quest its own "I am here", until the quest is walked', () => {
        const onConfirm = jest.fn()
        const items: ApiType.Game.QuestPoint[] = [
            { id: 'a', place: place('p1', 51.75), position: 1, state: 'open', value: 10 },
            { id: 'b', place: place('p2', 51.76), position: 2, state: 'open' }
        ]

        const { rerender } = render(
            <QuestSteps
                quest={quest('open', items)}
                onConfirm={onConfirm}
            />
        )

        const buttons = screen.getAllByRole('button', { name: 'game-here-button' })

        expect(buttons).toHaveLength(2)
        fireEvent.click(buttons[1])
        expect(onConfirm).toHaveBeenCalledWith('b')

        rerender(
            <QuestSteps
                quest={quest(
                    'open',
                    items.map((item) => ({ ...item, confirmedAt: '2026-11-11 10:00:00', state: 'done' as const })),
                    { confirmed: 2, finished: '2026-11-11 10:00:00', id: 'w1', started: '2026-11-11 09:00:00' }
                )}
                onConfirm={onConfirm}
            />
        )

        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
})
