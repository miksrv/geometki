import React from 'react'

import { render } from '@testing-library/react'

import { ApiModel } from '@/api'

import { PhotoLightbox } from './PhotoLightbox'

jest.mock('next/link', () => {
    const Link = ({ href, children }: any) => <a href={href}>{children}</a>
    Link.displayName = 'Link'
    return Link
})

jest.mock('next-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => opts?.defaultValue ?? key
    })
}))

jest.mock('yet-another-react-lightbox', () => ({
    __esModule: true,
    default: ({ open, slides, close }: any) =>
        open ? (
            <div
                data-testid={'lightbox'}
                onClick={close}
            >
                {slides?.map((s: any, i: number) => (
                    <div
                        key={i}
                        data-testid={'lightbox-slide'}
                    >
                        {s.alt}
                    </div>
                ))}
            </div>
        ) : null
}))

jest.mock('yet-another-react-lightbox/plugins/captions', () => ({ __esModule: true, default: {} }))
jest.mock('yet-another-react-lightbox/plugins/zoom', () => ({ __esModule: true, default: {} }))
jest.mock('yet-another-react-lightbox/plugins/captions.css', () => ({}), { virtual: true })
jest.mock('yet-another-react-lightbox/styles.css', () => ({}), { virtual: true })

jest.mock('@/config/env', () => ({
    IMG_HOST: 'https://img.example.com'
}))

jest.mock('@/utils/helpers', () => ({
    formatDate: jest.fn().mockReturnValue('15 Jan 2026')
}))

jest.mock('../user-avatar', () => ({
    UserAvatar: ({ user }: any) => <div data-testid={'user-avatar'}>{user?.name}</div>
}))

jest.mock('./ImageSlide', () => ({
    ImageSlide: () => <div data-testid={'image-slide'} />
}))

const mockPhotos: ApiModel.Photo[] = [
    { id: 'ph1', full: '/photos/full-1.jpg', preview: '/photos/prev-1.jpg', title: 'Photo 1', width: 800, height: 600 },
    { id: 'ph2', full: '/photos/full-2.jpg', preview: '/photos/prev-2.jpg', title: 'Photo 2', width: 800, height: 600 }
]

describe('PhotoLightbox', () => {
    describe('rendering', () => {
        it('does not render the lightbox when showLightbox is false', () => {
            const { queryByTestId } = render(
                <PhotoLightbox
                    photos={mockPhotos}
                    showLightbox={false}
                />
            )
            expect(queryByTestId('lightbox')).not.toBeInTheDocument()
        })

        it('renders the lightbox when showLightbox is true', () => {
            const { getByTestId } = render(
                <PhotoLightbox
                    photos={mockPhotos}
                    showLightbox={true}
                />
            )
            expect(getByTestId('lightbox')).toBeInTheDocument()
        })

        it('renders slides for each photo', () => {
            const { getAllByTestId } = render(
                <PhotoLightbox
                    photos={mockPhotos}
                    showLightbox={true}
                />
            )
            expect(getAllByTestId('lightbox-slide')).toHaveLength(2)
        })

        it('renders without photos (empty slides)', () => {
            const { getByTestId } = render(<PhotoLightbox showLightbox={true} />)
            expect(getByTestId('lightbox')).toBeInTheDocument()
        })
    })
})
