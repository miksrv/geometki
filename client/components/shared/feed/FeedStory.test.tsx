import React from 'react'

import { render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'

import { FeedStory } from './FeedStory'

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        i18n: { language: 'ru' },
        t: (key: string, opts?: Record<string, unknown>) =>
            opts?.count !== undefined ? `${key}:${String(opts.count)}` : key
    })
}))

jest.mock('next/link', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Link = ({ href, className, children }: any) => (
        <a
            href={href}
            className={className}
        >
            {children}
        </a>
    )
    Link.displayName = 'Link'
    return Link
})

jest.mock('@/utils/helpers', () => ({
    buildCollectionUrl: (id: string) => `/collections/${id}`,
    formatDate: () => '13 октября 2026, 10:00',
    removeMarkdown: (text: string) => text.replace(/\*/g, ''),
    timeAgo: () => '5 минут назад'
}))

jest.mock('@/components/shared/user-avatar', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    UserAvatar: ({ user, size }: any) => (
        <span
            data-testid={'avatar'}
            data-size={size}
        >
            {user?.name}
        </span>
    )
}))

jest.mock('@/components/shared/place-card', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PlaceCard: ({ place, variant, footer }: any) => (
        <div
            data-testid={'place-card'}
            data-variant={variant ?? 'tile'}
        >
            {place.title}
            {footer}
        </div>
    )
}))

jest.mock('@/components/shared/collection-card', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    CollectionCard: ({ collection, showAuthor }: any) => (
        <div
            data-testid={'collection-card'}
            data-show-author={String(showAuthor)}
        >
            {collection.title}
        </div>
    )
}))

jest.mock('@/components/shared/achievement-icon', () => ({
    AchievementIcon: () => <span data-testid={'achievement-icon'} />
}))

jest.mock('@/components/shared/level-badge/LevelBadge', () => ({
    LevelBadge: ({ level }: { level: number }) => <span data-testid={'level-badge'}>{level}</span>
}))

jest.mock('./FeedPhotoMosaic', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    FeedPhotoMosaic: ({ photos, total, layout }: any) => (
        <div
            data-testid={'mosaic'}
            data-layout={layout ?? 'grid'}
            data-total={total}
        >
            {photos.length}
        </div>
    )
}))

const date = { date: '2026-10-13 10:00:00.000000', timezone: 'UTC', timezone_type: 3 }

const place = (id: string, title: string): ApiModel.PlaceListItem => ({ id, lat: 0, lon: 0, title })

const photo = (id: string): ApiModel.Photo => ({
    full: `${id}.jpg`,
    height: 600,
    id,
    preview: `${id}_p.jpg`,
    width: 800
})

const story = (overrides: Partial<ApiModel.FeedStory>): ApiModel.FeedStory => ({
    author: { id: 'u1', name: 'Мария' },
    count: 1,
    created: date,
    id: 's1',
    type: 'place',
    updated: date,
    weight: 3,
    ...overrides
})

describe('FeedStory', () => {
    describe('head', () => {
        it('names the author, the action and the time', () => {
            render(<FeedStory story={story({ place: place('p1', 'Водопад') })} />)

            expect(screen.getByRole('link', { name: 'Мария' })).toHaveAttribute('href', '/users/u1')
            expect(screen.getByText('feed-action-place')).toBeInTheDocument()
            expect(screen.getByText('5 минут назад')).toHaveAttribute('dateTime', date.date)
        })

        it('calls guests "guests" without a profile link', () => {
            render(
                <FeedStory
                    story={story({
                        author: undefined,
                        places: [{ ...place('p1', 'Водопад'), value: 4 }],
                        type: 'rating',
                        weight: 1
                    })}
                />
            )

            expect(screen.queryByRole('link', { name: 'feed-guests' })).toBeNull()
            expect(screen.getAllByText('feed-guests').length).toBeGreaterThan(0)
        })

        it('uses an avatar as tall as the two lines of the head, also for compact stories', () => {
            render(
                <FeedStory
                    density={'compact'}
                    story={story({ place: place('p1', 'Водопад'), type: 'edit', weight: 1 })}
                />
            )

            expect(screen.getByTestId('avatar')).toHaveAttribute('data-size', 'medium')
        })

        it.each([
            [['description'], 'feed-action-edit-description'],
            [['cover'], 'feed-action-edit-cover'],
            [['description', 'cover'], 'feed-action-edit-both']
        ] as const)('names the edit by what changed: %j', (changes, key) => {
            render(
                <FeedStory
                    story={story({ changes: [...changes], place: place('p1', 'Водопад'), type: 'edit', weight: 1 })}
                />
            )

            expect(screen.getByText(key)).toBeInTheDocument()
        })

        it('counts the photos and the places', () => {
            const { rerender } = render(
                <FeedStory story={story({ photos: [photo('a')], photosCount: 12, type: 'photo' })} />
            )
            expect(screen.getByText('feed-action-photo:12')).toBeInTheDocument()

            rerender(
                <FeedStory
                    story={story({
                        places: [place('p1', 'A'), place('p2', 'B')],
                        placesCount: 5,
                        type: 'visit',
                        weight: 1
                    })}
                />
            )
            expect(screen.getByText('feed-action-visit:5')).toBeInTheDocument()
        })

        it('links the collection a place was added to', () => {
            render(
                <FeedStory
                    story={story({
                        collection: { id: 'c1', placesCount: 9, title: 'Водопады Урала' },
                        places: [place('p1', 'A')],
                        placesCount: 1,
                        type: 'collection_place',
                        weight: 1
                    })}
                />
            )

            expect(screen.getByRole('link', { name: 'Водопады Урала' })).toHaveAttribute('href', '/collections/c1')
        })
    })

    describe('body', () => {
        it('shows a new place as a tile with its description and a strip of its photos', () => {
            render(
                <FeedStory
                    story={story({
                        photos: [photo('a'), photo('b')],
                        photosCount: 7,
                        place: { ...place('p1', 'Водопад'), content: 'Высокий **водопад**' }
                    })}
                />
            )

            expect(screen.getByTestId('place-card')).toHaveAttribute('data-variant', 'tile')
            expect(screen.getByText('Высокий водопад')).toBeInTheDocument()
            expect(screen.getByTestId('mosaic')).toHaveAttribute('data-layout', 'strip')
            expect(screen.getByTestId('mosaic')).toHaveAttribute('data-total', '7')
        })

        it('shows a new place with one photo without a strip: the photo is its cover', () => {
            render(<FeedStory story={story({ photos: [photo('a')], photosCount: 1, place: place('p1', 'Водопад') })} />)

            expect(screen.queryByTestId('mosaic')).toBeNull()
        })

        it('shows a new place as a row in compact density: the row has the description itself', () => {
            render(
                <FeedStory
                    density={'compact'}
                    story={story({ place: { ...place('p1', 'Водопад'), content: 'Высокий водопад' } })}
                />
            )

            expect(screen.getByTestId('place-card')).toHaveAttribute('data-variant', 'row')
            expect(screen.queryByText('Высокий водопад')).toBeNull()
        })

        it('shows photos as a mosaic with the place under it', () => {
            render(
                <FeedStory
                    story={story({ photos: [photo('a'), photo('b')], place: place('p1', 'Водопад'), type: 'photo' })}
                />
            )

            expect(screen.getByTestId('mosaic')).toHaveAttribute('data-layout', 'grid')
            expect(screen.getByTestId('place-card')).toHaveAttribute('data-variant', 'row')
        })

        it('shows linked photos as a mosaic with the place under it, under their own heading', () => {
            render(
                <FeedStory
                    story={story({
                        photos: [photo('a'), photo('b')],
                        photosCount: 2,
                        place: place('p1', 'Водопад'),
                        type: 'photo_link'
                    })}
                />
            )

            expect(screen.getByText('feed-action-photo-link:2')).toBeInTheDocument()
            expect(screen.getByTestId('mosaic')).toHaveAttribute('data-layout', 'grid')
            expect(screen.getByTestId('place-card')).toHaveAttribute('data-variant', 'row')
        })

        it('quotes a review', () => {
            render(
                <FeedStory
                    story={story({
                        comment: { content: 'Очень красиво', id: 'c1' },
                        place: place('p1', 'Водопад'),
                        type: 'comment',
                        weight: 2
                    })}
                />
            )

            expect(screen.getByText('Очень красиво').closest('blockquote')).not.toBeNull()
        })

        it('lists the rated places with their scores and counts the rest', () => {
            render(
                <FeedStory
                    story={story({
                        places: [
                            { ...place('p1', 'A'), value: 5 },
                            { ...place('p2', 'B'), value: 3 },
                            { ...place('p3', 'C'), value: 4 }
                        ],
                        placesCount: 8,
                        type: 'rating',
                        weight: 1
                    })}
                />
            )

            expect(screen.getAllByTestId('place-card')).toHaveLength(3)
            expect(screen.getAllByRole('img', { name: 'feed-score' })).toHaveLength(3)
            expect(screen.getByText('feed-more-places:5')).toBeInTheDocument()
        })

        it('shows a collection card without the author', () => {
            render(
                <FeedStory
                    story={story({
                        collection: { id: 'c1', placesCount: 9, title: 'Водопады Урала' },
                        type: 'collection'
                    })}
                />
            )

            expect(screen.getByTestId('collection-card')).toHaveAttribute('data-show-author', 'false')
        })

        it('shows an achievement with its tier and a link to the achievements', () => {
            render(
                <FeedStory
                    story={story({
                        achievement: { id: 'a1', tier: 'gold', title: 'Первооткрыватель' },
                        type: 'achievement',
                        weight: 2
                    })}
                />
            )

            expect(screen.getByText('Первооткрыватель')).toBeInTheDocument()
            expect(screen.getByText('achievements-tier-gold')).toBeInTheDocument()
            expect(screen.getByRole('link', { name: /Первооткрыватель/ })).toHaveAttribute(
                'href',
                '/users/u1/achievements'
            )
        })

        it('shows the level reached', () => {
            render(<FeedStory story={story({ level: 7, type: 'level', weight: 2 })} />)

            expect(screen.getByTestId('level-badge')).toHaveTextContent('7')
            expect(screen.getByText('feed-level')).toBeInTheDocument()
        })
    })

    describe('place history', () => {
        it('does not attach the place, the page is the place', () => {
            render(
                <FeedStory
                    hidePlace={true}
                    story={story({ place: place('p1', 'Водопад'), type: 'edit', weight: 1 })}
                />
            )

            expect(screen.queryByTestId('place-card')).toBeNull()
        })

        it('shows the photos of a new place as a mosaic', () => {
            render(
                <FeedStory
                    hidePlace={true}
                    story={story({ photos: [photo('a')], photosCount: 1, place: place('p1', 'Водопад') })}
                />
            )

            expect(screen.getByTestId('mosaic')).toHaveAttribute('data-layout', 'grid')
        })

        it('puts the score of a rating into the head', () => {
            render(
                <FeedStory
                    hidePlace={true}
                    story={story({ places: [{ ...place('p1', 'Водопад'), value: 4 }], type: 'rating', weight: 1 })}
                />
            )

            expect(screen.getByRole('img', { name: 'feed-score' })).toBeInTheDocument()
            expect(screen.queryByTestId('place-card')).toBeNull()
        })
    })
})
