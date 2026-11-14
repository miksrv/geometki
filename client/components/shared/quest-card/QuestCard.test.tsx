import React from 'react'

import { render, screen } from '@testing-library/react'

import { ApiType } from '@/api'

import { QuestCard } from './QuestCard'

jest.mock('simple-react-ui-kit', () => ({
    Icon: ({ name }: { name: string }) => <i data-testid={`icon-${name}`} />,
    cn: (...args: unknown[]) => args.filter(Boolean).join(' ')
}))

jest.mock('next/image', () => {
    const Image = ({ src, alt }: { src: string; alt: string }) => (
        <img
            src={src}
            alt={alt}
        />
    )
    Image.displayName = 'Image'
    return Image
})

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

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        i18n: { language: 'ru' },
        t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${Object.values(opts).join(',')}` : key)
    })
}))

jest.mock('@/config/env', () => ({
    IMG_HOST: 'https://img.test/'
}))

const quest: ApiType.Game.Quest = {
    bonus: 30,
    cover: { preview: 'uploads/places/p1/cover_preview.jpg' },
    description: null,
    id: 'r1',
    length: 1440,
    location: 'Оренбург',
    mode: 'steps',
    points: 6,
    status: 'published',
    title: 'Космический Оренбург',
    walk: null,
    walked: 0
}

describe('QuestCard', () => {
    it('is one link with the cover, the mode, the town, the description, the facts and the experience', () => {
        const { container } = render(
            <QuestCard
                quest={{
                    ...quest,
                    cover: { full: 'uploads/places/p1/cover.jpg', preview: 'uploads/places/p1/cover_preview.jpg' },
                    description: 'От училища к памятнику',
                    distance: 1250
                }}
            />
        )

        expect(screen.getAllByRole('link')).toHaveLength(1)
        expect(screen.getByRole('link', { name: 'Космический Оренбург' })).toHaveAttribute('href', '/quests/r1')
        expect(screen.getByRole('heading', { level: 2, name: 'Космический Оренбург' })).toBeInTheDocument()
        // A wide card takes the full cover; the picture is decorative
        expect(container.querySelector('img')).toHaveAttribute('src', 'https://img.test/uploads/places/p1/cover.jpg')
        expect(screen.getByText('game-quest-mode-steps')).toBeInTheDocument()
        expect(screen.getByText('Оренбург')).toBeInTheDocument()
        expect(screen.getByText('От училища к памятнику')).toBeInTheDocument()
        // 1.4 km at 4 km/h and four minutes at each of 6 points: 45 minutes
        expect(screen.getByText('game-quest-points:6')).toBeInTheDocument()
        expect(screen.getByText('1,4 км')).toBeInTheDocument()
        expect(screen.getByText('≈ game-time-minutes:45')).toBeInTheDocument()
        // Over the cover: the distance from the visitor
        expect(screen.getByText('1,25 км')).toBeInTheDocument()
        // Nobody walked it yet: an invitation to be the first
        expect(screen.getByText('game-quest-walked-none')).toBeInTheDocument()
        // A quest gives experience: it is no part of a season
        expect(screen.getByText('game-quest-bonus:30')).toHaveAttribute('title', 'game-quest-experience:30')
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
        expect(screen.queryByText('game-quest-draft')).not.toBeInTheDocument()
    })

    it('shows a begun walk as a bar, and a walked quest as walked', () => {
        const { rerender } = render(
            <QuestCard quest={{ ...quest, walk: { confirmed: 3, finished: null, id: 'w1', started: '2026-11-11' } }} />
        )

        const bar = screen.getByRole('progressbar', { name: 'game-quest-progress:3,6' })
        expect(bar).toHaveAttribute('aria-valuenow', '3')
        expect(bar.firstChild).toHaveStyle({ width: '50%' })
        // Walking it: the bonus is on its way, not offered
        expect(screen.queryByText('game-quest-bonus:30')).not.toBeInTheDocument()

        rerender(
            <QuestCard
                quest={{
                    ...quest,
                    walk: { confirmed: 6, finished: '2026-11-11 12:00:00', id: 'w1', started: '2026-11-11' }
                }}
            />
        )

        expect(screen.getByText('game-quest-walked')).toBeInTheDocument()
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    })

    it('says how many walked it', () => {
        render(<QuestCard quest={{ ...quest, walked: 12 }} />)

        expect(screen.getByText('game-quest-walked-by:12')).toBeInTheDocument()
        expect(screen.queryByText('game-quest-walked-none')).not.toBeInTheDocument()
    })

    it("keeps the mode's icon for a quest whose first point has no cover", () => {
        const { container } = render(<QuestCard quest={{ ...quest, cover: undefined }} />)

        expect(container.querySelector('img')).not.toBeInTheDocument()
        expect(screen.getAllByTestId('icon-Compass').length).toBeGreaterThan(0)
    })

    it('shows the bar of a walk begun without a point yet', () => {
        render(
            <QuestCard quest={{ ...quest, walk: { confirmed: 0, finished: null, id: 'w1', started: '2026-11-11' } }} />
        )

        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
    })

    it('gives a riddle quest the drawn map of the riddle quests and marks a draft', () => {
        const { container } = render(
            <QuestCard
                quest={{ ...quest, cover: undefined, mode: 'riddles', status: 'draft' }}
                headingLevel={3}
            />
        )

        // Its places are the answers: none of them is its picture
        expect(container.querySelector('img')).toHaveAttribute('src', '/images/quests/riddle-cover.webp')
        expect(screen.getByText('game-quest-mode-riddles')).toBeInTheDocument()
        expect(screen.getByText('game-quest-draft')).toBeInTheDocument()
        expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument()
    })

    it('small: the overline in place of the mode, one line of facts, the progress and the action', () => {
        const { container } = render(
            <QuestCard
                quest={{
                    ...quest,
                    description: 'От училища к памятнику',
                    walk: { confirmed: 1, finished: null, id: 'w1', started: '2026-11-10' }
                }}
                size={'small'}
                overline={'home-quest-overline'}
                action={<button type={'button'}>home-quest-continue</button>}
            />
        )

        expect(screen.getByText('home-quest-overline')).toBeInTheDocument()
        expect(screen.queryByText('game-quest-mode-steps')).not.toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Космический Оренбург' })).toHaveAttribute('href', '/quests/r1')
        // A narrow cover: the preview is enough
        expect(container.querySelector('img')).toHaveAttribute(
            'src',
            'https://img.test/uploads/places/p1/cover_preview.jpg'
        )
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '6')
        expect(screen.getByText('game-quest-progress:1,6')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'home-quest-continue' })).toBeInTheDocument()
        // Low on purpose: one line of the town, the points and the length, no description
        expect(screen.getByText('Оренбург · game-quest-points:6 · 1,4 км')).toBeInTheDocument()
        expect(screen.queryByText('От училища к памятнику')).not.toBeInTheDocument()
    })
})
