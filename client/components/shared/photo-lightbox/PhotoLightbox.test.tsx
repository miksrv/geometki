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

let lightboxProps: any

jest.mock('yet-another-react-lightbox', () => ({
    __esModule: true,
    isImageSlide: () => true,
    default: (props: any) => {
        lightboxProps = props
        const { open, slides, close } = props
        return open ? (
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
    }
}))

jest.mock('yet-another-react-lightbox/plugins/captions', () => ({ __esModule: true, default: {} }))
jest.mock('yet-another-react-lightbox/plugins/zoom', () => ({ __esModule: true, default: {} }))
jest.mock('yet-another-react-lightbox/plugins/captions.css', () => ({}), { virtual: true })
jest.mock('yet-another-react-lightbox/styles.css', () => ({}), { virtual: true })

jest.mock('next/image', () => ({
    getImageProps: ({ src }: { src: string }) => ({
        props: { srcSet: [640, 1080, 1920].map((w) => `/_next/image?url=${src}&w=${w} ${w}w`).join(', ') }
    })
}))

jest.mock('@/config/env', () => ({
    IMG_HOST: 'https://img.example.com'
}))

jest.mock('@/utils/helpers', () => ({
    formatDate: jest.fn().mockReturnValue('15 Jan 2026')
}))

jest.mock('../user-avatar', () => ({
    UserAvatar: ({ user }: any) => <div data-testid={'user-avatar'}>{user?.name}</div>
}))

jest.mock('./SlidePreview', () => ({
    SlidePreview: ({ children }: any) => <>{children}</>
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

    describe('slides', () => {
        it('builds optimized sources of our photo, capped at its own size', () => {
            render(
                <PhotoLightbox
                    photos={mockPhotos}
                    showLightbox={true}
                />
            )
            const [slide] = lightboxProps.slides
            expect(slide.src).toBe('https://img.example.com/photos/full-1.jpg')
            expect(slide.preview).toBe('https://img.example.com/photos/prev-1.jpg')
            expect(slide.srcSet).toStrictEqual([
                { height: 480, src: '/_next/image?url=https://img.example.com/photos/full-1.jpg&w=640', width: 640 },
                { height: 600, src: '/_next/image?url=https://img.example.com/photos/full-1.jpg&w=1080', width: 800 }
            ])
        })

        it('uses an external photo as is', () => {
            render(
                <PhotoLightbox
                    photos={[
                        {
                            full: 'https://ext.org/a.jpg',
                            height: 600,
                            lat: 1,
                            lon: 2,
                            preview: 'https://ext.org/a-s.jpg',
                            width: 800
                        }
                    ]}
                    showLightbox={true}
                />
            )
            const [slide] = lightboxProps.slides
            expect(slide.src).toBe('https://ext.org/a.jpg')
            expect(slide.preview).toBe('https://ext.org/a-s.jpg')
            expect(slide.srcSet).toBeUndefined()
        })
    })

    describe('navigation', () => {
        it('hides the arrows and stops looping for a single photo', () => {
            render(
                <PhotoLightbox
                    photos={[mockPhotos[0]]}
                    showLightbox={true}
                />
            )
            expect(lightboxProps.carousel.finite).toBe(true)
            expect(lightboxProps.render.buttonPrev()).toBeNull()
            expect(lightboxProps.render.buttonNext()).toBeNull()
        })

        it('keeps the arrows and looping for several photos', () => {
            render(
                <PhotoLightbox
                    photos={mockPhotos}
                    photoIndex={1}
                    showLightbox={true}
                />
            )
            expect(lightboxProps.index).toBe(1)
            expect(lightboxProps.carousel.finite).toBe(false)
            expect(lightboxProps.render.buttonPrev).toBeUndefined()
            expect(lightboxProps.render.buttonNext).toBeUndefined()
        })
    })
})
