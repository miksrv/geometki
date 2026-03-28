import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'

import { ActivityListItem } from './ActivityListItem'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: string[]) => args.filter(Boolean).join(' '),
    Container: ({ children, title, className }: any) => (
        <div
            className={className}
            data-title={title}
        >
            {children}
        </div>
    ),
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
        t: (key: string, opts?: Record<string, unknown>) => opts?.defaultValue ?? key
    })
}))

jest.mock('react-photo-album', () => ({
    __esModule: true,
    default: ({ photos, onClick }: any) => (
        <div data-testid={'photo-album'}>
            {photos?.map((p: any, i: number) => (
                <img
                    key={i}
                    src={p.src}
                    data-testid={'album-photo'}
                    onClick={() => onClick?.({ index: i })}
                    alt={''}
                />
            ))}
        </div>
    )
}))

jest.mock('react-photo-album/rows.css', () => ({}), { virtual: true })

jest.mock('@/components/shared', () => ({
    PhotoLightbox: ({ showLightbox }: any) => (showLightbox ? <div data-testid={'photo-lightbox'} /> : null),
    Rating: ({ value }: { value: number }) => (
        <div
            data-testid={'rating'}
            data-value={value}
        />
    ),
    UserAvatar: ({ showName, caption }: any) => (
        <div data-testid={'user-avatar'}>
            {showName && <span data-testid={'name-shown'} />}
            {caption && <span data-testid={'caption'}>{caption}</span>}
        </div>
    )
}))

jest.mock('@/components/ui', () => ({
    ReadMore: ({ children, showMoreText }: any) => (
        <div
            data-testid={'read-more'}
            data-show-more={showMoreText}
        >
            {children}
        </div>
    )
}))

jest.mock('@/config/env', () => ({
    IMG_HOST: 'https://img.example.com'
}))

jest.mock('@/utils/helpers', () => ({
    formatDate: jest.fn().mockReturnValue('01.01.2026')
}))

const baseActivity: ApiModel.Activity = {
    type: 'place',
    place: { id: 'p1', title: 'Awesome Cave', lat: 55.0, lon: 37.0, content: 'Some **content** here' },
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
            expect(screen.getByTitle('Awesome Cave')).toBeInTheDocument()
        })

        it('renders a link to the place', () => {
            render(<ActivityListItem item={baseActivity} />)
            expect(screen.getByTitle('Awesome Cave')).toHaveAttribute('href', '/places/p1')
        })

        it('renders view counter when views are provided', () => {
            render(<ActivityListItem item={baseActivity} />)
            expect(screen.getByTestId('icon-Eye')).toBeInTheDocument()
        })

        it('does not render view counter when views is 0', () => {
            render(<ActivityListItem item={{ ...baseActivity, views: 0 }} />)
            expect(screen.queryByTestId('icon-Eye')).not.toBeInTheDocument()
        })

        it('renders the title when title prop is provided', () => {
            render(
                <ActivityListItem
                    item={baseActivity}
                    title={'Activity Title'}
                />
            )
            // Title is passed to the Container component
            const container = document.querySelector('[data-title="Activity Title"]')
            expect(container).toBeInTheDocument()
        })
    })

    describe('place/edit type with content', () => {
        it('renders ReadMore for place type with content', () => {
            render(<ActivityListItem item={baseActivity} />)
            expect(screen.getByTestId('read-more')).toBeInTheDocument()
        })

        it('renders ReadMore for edit type with content', () => {
            const editActivity: ApiModel.Activity = {
                ...baseActivity,
                type: 'edit'
            }
            render(<ActivityListItem item={editActivity} />)
            expect(screen.getByTestId('read-more')).toBeInTheDocument()
        })

        it('does not render ReadMore for comment type', () => {
            const commentActivity: ApiModel.Activity = {
                type: 'comment',
                place: { id: 'p1', title: 'Place', lat: 0, lon: 0 },
                comment: { id: 'c1', content: 'Nice place!' }
            }
            render(<ActivityListItem item={commentActivity} />)
            expect(screen.queryByTestId('read-more')).not.toBeInTheDocument()
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
        it('renders photo album when photos are present', () => {
            const photoActivity: ApiModel.Activity = {
                type: 'photo',
                place: { id: 'p1', title: 'Place', lat: 0, lon: 0 },
                photos: [
                    { id: 'ph1', full: '/full-1.jpg', preview: '/prev-1.jpg', title: 'Ph1', width: 800, height: 600 }
                ]
            }
            render(<ActivityListItem item={photoActivity} />)
            expect(screen.getByTestId('photo-album')).toBeInTheDocument()
        })

        it('opens lightbox when photo is clicked', () => {
            const photoActivity: ApiModel.Activity = {
                type: 'photo',
                place: { id: 'p1', title: 'Place', lat: 0, lon: 0 },
                photos: [
                    { id: 'ph1', full: '/full-1.jpg', preview: '/prev-1.jpg', title: 'Ph1', width: 800, height: 600 }
                ]
            }
            render(<ActivityListItem item={photoActivity} />)
            fireEvent.click(screen.getByTestId('album-photo'))
            expect(screen.getByTestId('photo-lightbox')).toBeInTheDocument()
        })
    })

    describe('edit type with difference', () => {
        it('renders positive difference with + sign', () => {
            const editActivity: ApiModel.Activity = {
                type: 'edit',
                place: { id: 'p1', title: 'Place', lat: 0, lon: 0, content: 'Content', difference: 50 }
            }
            render(<ActivityListItem item={editActivity} />)
            expect(screen.getByText('+50')).toBeInTheDocument()
        })

        it('renders negative difference', () => {
            const editActivity: ApiModel.Activity = {
                type: 'edit',
                place: { id: 'p1', title: 'Place', lat: 0, lon: 0, content: 'Content', difference: -20 }
            }
            render(<ActivityListItem item={editActivity} />)
            expect(screen.getByText('-20')).toBeInTheDocument()
        })
    })
})
