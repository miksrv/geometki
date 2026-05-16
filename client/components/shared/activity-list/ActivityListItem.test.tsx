import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'

import { ActivityListItem } from './ActivityListItem'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: string[]) => args.filter(Boolean).join(' '),
    Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />
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

jest.mock('next-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => opts?.defaultValue ?? key,
        i18n: { language: 'ru' }
    })
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => opts?.defaultValue ?? key,
        i18n: { language: 'ru' }
    })
}))

jest.mock('@/components/shared', () => ({
    PhotoLightbox: ({ showLightbox }: any) => (showLightbox ? <div data-testid={'photo-lightbox'} /> : null),
    Rating: ({ value }: { value: number }) => (
        <div
            data-testid={'rating'}
            data-value={value}
        />
    ),
    UserAvatar: ({ size }: any) => (
        <div
            data-testid={'user-avatar'}
            data-size={size}
        />
    )
}))

jest.mock('@/config/env', () => ({
    IMG_HOST: 'https://img.example.com'
}))

jest.mock('@/utils/helpers', () => ({
    formatDate: jest.fn().mockReturnValue('01.01.2026'),
    removeMarkdown: jest.fn().mockImplementation((s: string) => s),
    timeAgo: jest.fn().mockReturnValue('2 часа назад')
}))

const baseActivity: ApiModel.Activity = {
    type: 'place',
    place: {
        id: 'p1',
        title: 'Awesome Cave',
        lat: 55.0,
        lon: 37.0,
        content: 'Some **content** here',
        cover: { preview: '/photos/p1/cover_preview.jpg' }
    },
    author: { id: 'u1', name: 'Alice' },
    views: 42
}

describe('ActivityListItem', () => {
    describe('rendering', () => {
        it('renders without crashing', () => {
            const { container } = render(<ActivityListItem item={baseActivity} />)
            expect(container.firstChild).toBeInTheDocument()
        })

        it('renders the UserAvatar', () => {
            render(<ActivityListItem item={baseActivity} />)
            expect(screen.getByTestId('user-avatar')).toBeInTheDocument()
        })

        it('renders the place title link', () => {
            render(<ActivityListItem item={baseActivity} />)
            const links = screen.getAllByTitle('Awesome Cave')
            expect(links.length).toBeGreaterThanOrEqual(1)
        })

        it('renders a link to the place', () => {
            render(<ActivityListItem item={baseActivity} />)
            const links = screen.getAllByTitle('Awesome Cave')
            expect(links.some((el) => el.getAttribute('href') === '/places/p1')).toBe(true)
        })

        it('renders view counter when views are provided', () => {
            render(<ActivityListItem item={baseActivity} />)
            expect(screen.getByTestId('icon-Eye')).toBeInTheDocument()
        })

        it('does not render view counter when views is 0', () => {
            render(<ActivityListItem item={{ ...baseActivity, views: 0 }} />)
            expect(screen.queryByTestId('icon-Eye')).not.toBeInTheDocument()
        })
    })

    describe('author name', () => {
        it('renders author name as a link to user profile', () => {
            render(<ActivityListItem item={baseActivity} />)
            const link = screen.getByText('Alice')
            expect(link.tagName).toBe('A')
            expect(link).toHaveAttribute('href', '/users/u1')
        })

        it('renders guest label when no author id', () => {
            render(<ActivityListItem item={{ ...baseActivity, author: { name: 'Anonymous' } }} />)
            expect(screen.getByText('Гость')).toBeInTheDocument()
        })
    })

    describe('action text', () => {
        it('renders action text for place type', () => {
            render(<ActivityListItem item={baseActivity} />)
            expect(screen.getByText('добавил(-а) место')).toBeInTheDocument()
        })

        it('renders action text for rating type', () => {
            render(<ActivityListItem item={{ ...baseActivity, type: 'rating', rating: { value: 4 } }} />)
            expect(screen.getByText('оценил(-а) место')).toBeInTheDocument()
        })

        it('renders action text for comment type', () => {
            render(
                <ActivityListItem
                    item={{ ...baseActivity, type: 'comment', comment: { id: 'c1', content: 'hello' } }}
                />
            )
            expect(screen.getByText('прокомментировал(-а) место')).toBeInTheDocument()
        })
    })

    describe('time display', () => {
        it('renders timeAgo instead of formatted date', () => {
            render(<ActivityListItem item={baseActivity} />)
            expect(screen.getByText('2 часа назад')).toBeInTheDocument()
        })
    })

    describe('place/edit content', () => {
        it('renders content for place type', () => {
            render(<ActivityListItem item={baseActivity} />)
            expect(screen.getByText('Some **content** here')).toBeInTheDocument()
        })

        it('renders content for edit type', () => {
            render(<ActivityListItem item={{ ...baseActivity, type: 'edit' }} />)
            expect(screen.getByText('Some **content** here')).toBeInTheDocument()
        })

        it('does not render content for comment type', () => {
            const commentActivity: ApiModel.Activity = {
                type: 'comment',
                place: { id: 'p1', title: 'Place', lat: 0, lon: 0 },
                comment: { id: 'c1', content: 'Nice place!' }
            }
            render(<ActivityListItem item={commentActivity} />)
            expect(screen.queryByText('Some **content** here')).not.toBeInTheDocument()
        })

        it('hides content in compact mode', () => {
            render(
                <ActivityListItem
                    item={baseActivity}
                    compact={true}
                />
            )
            expect(screen.queryByText('Some **content** here')).not.toBeInTheDocument()
        })
    })

    describe('cover thumbnail', () => {
        it('renders cover thumbnail for non-photo types', () => {
            render(<ActivityListItem item={baseActivity} />)
            const img = screen.getByAltText('Awesome Cave')
            expect(img).toBeInTheDocument()
            expect(img).toHaveAttribute('src', 'https://img.example.com/photos/p1/cover_preview.jpg')
        })

        it('does not render cover thumbnail for photo type', () => {
            const photoActivity: ApiModel.Activity = {
                type: 'photo',
                place: {
                    id: 'p1',
                    title: 'Place',
                    lat: 0,
                    lon: 0,
                    cover: { preview: '/photos/p1/cover_preview.jpg' }
                },
                photos: [
                    { id: 'ph1', full: '/full-1.jpg', preview: '/prev-1.jpg', title: 'Ph1', width: 800, height: 600 }
                ]
            }
            render(<ActivityListItem item={photoActivity} />)
            expect(screen.queryByAltText('Place')).not.toBeInTheDocument()
        })

        it('does not render cover thumbnail when place has no cover', () => {
            const noCoverActivity: ApiModel.Activity = {
                ...baseActivity,
                place: { id: 'p1', title: 'Cave', lat: 0, lon: 0 }
            }
            render(<ActivityListItem item={noCoverActivity} />)
            expect(screen.queryByAltText('Cave')).not.toBeInTheDocument()
        })
    })

    describe('compact mode', () => {
        it('uses small avatar in compact mode', () => {
            render(
                <ActivityListItem
                    item={baseActivity}
                    compact={true}
                />
            )
            expect(screen.getByTestId('user-avatar')).toHaveAttribute('data-size', 'small')
        })

        it('uses medium avatar in full mode', () => {
            render(<ActivityListItem item={baseActivity} />)
            expect(screen.getByTestId('user-avatar')).toHaveAttribute('data-size', 'medium')
        })

        it('does not render view counter in compact mode', () => {
            render(
                <ActivityListItem
                    item={baseActivity}
                    compact={true}
                />
            )
            expect(screen.queryByTestId('icon-Eye')).not.toBeInTheDocument()
        })

        it('does not render comment blockquote in compact mode', () => {
            const commentActivity: ApiModel.Activity = {
                type: 'comment',
                place: { id: 'p1', title: 'Place', lat: 0, lon: 0 },
                comment: { id: 'c1', content: 'Nice place!' }
            }
            render(
                <ActivityListItem
                    item={commentActivity}
                    compact={true}
                />
            )
            expect(screen.queryByText('Nice place!')).not.toBeInTheDocument()
        })
    })

    describe('comment type', () => {
        it('renders comment content in a blockquote', () => {
            const commentActivity: ApiModel.Activity = {
                type: 'comment',
                place: { id: 'p1', title: 'Place', lat: 0, lon: 0 },
                comment: { id: 'c1', content: 'This place is amazing!' }
            }
            render(<ActivityListItem item={commentActivity} />)
            expect(screen.getByText('This place is amazing!')).toBeInTheDocument()
        })
    })

    describe('rating type', () => {
        it('renders Rating component when rating value is present', () => {
            const ratingActivity: ApiModel.Activity = {
                type: 'rating',
                place: { id: 'p1', title: 'Place', lat: 0, lon: 0 },
                rating: { value: 4 }
            }
            render(<ActivityListItem item={ratingActivity} />)
            expect(screen.getByTestId('rating')).toBeInTheDocument()
        })
    })

    describe('photos', () => {
        it('renders photo thumbnails when photos are present', () => {
            const photoActivity: ApiModel.Activity = {
                type: 'photo',
                place: { id: 'p1', title: 'Place', lat: 0, lon: 0 },
                photos: [
                    { id: 'ph1', full: '/full-1.jpg', preview: '/prev-1.jpg', title: 'Ph1', width: 800, height: 600 },
                    { id: 'ph2', full: '/full-2.jpg', preview: '/prev-2.jpg', title: 'Ph2', width: 800, height: 600 }
                ]
            }
            render(<ActivityListItem item={photoActivity} />)
            const buttons = screen.getAllByRole('button', { name: /^Фото/ })
            expect(buttons.length).toBeGreaterThanOrEqual(2)
        })

        it('opens lightbox when photo thumbnail is clicked', () => {
            const photoActivity: ApiModel.Activity = {
                type: 'photo',
                place: { id: 'p1', title: 'Place', lat: 0, lon: 0 },
                photos: [
                    { id: 'ph1', full: '/full-1.jpg', preview: '/prev-1.jpg', title: 'Ph1', width: 800, height: 600 }
                ]
            }
            render(<ActivityListItem item={photoActivity} />)
            const buttons = screen.getAllByRole('button')
            fireEvent.click(buttons[0])
            expect(screen.getByTestId('photo-lightbox')).toBeInTheDocument()
        })
    })
})
