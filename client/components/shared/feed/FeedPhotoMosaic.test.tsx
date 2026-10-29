import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'

import { FeedPhotoMosaic } from './FeedPhotoMosaic'

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => {
            if (key === 'feed-photo-alt') {
                return `${String(opts?.title)} — фото ${String(opts?.number)}`
            }
            if (key === 'feed-photo-more') {
                return `ещё ${String(opts?.count)} фото`
            }
            return (opts?.defaultValue as string) ?? key
        }
    })
}))

jest.mock('next/image', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Image = ({ src, alt }: any) => (
        <span
            data-testid={'image'}
            data-src={src}
            data-alt={alt}
        />
    )
    Image.displayName = 'Image'
    return Image
})

jest.mock('@/config/env', () => ({ IMG_HOST: 'https://img.test/' }))

// The lightbox is loaded lazily on the first tap
jest.mock('next/dynamic', () => () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PhotoLightbox = ({ showLightbox, photoIndex, photos }: any) =>
        showLightbox ? (
            <div data-testid={'lightbox'}>
                {photoIndex}/{photos.length}
            </div>
        ) : null
    return PhotoLightbox
})

const photos: ApiModel.Photo[] = Array.from({ length: 8 }, (_, index) => ({
    full: `p${index}.jpg`,
    height: 600,
    id: `p${index}`,
    preview: `p${index}_preview.jpg`,
    width: 800
}))

describe('FeedPhotoMosaic', () => {
    it('shows up to four photos in a grid with "+N" on the last one', () => {
        render(
            <FeedPhotoMosaic
                photos={photos}
                total={12}
            />
        )

        expect(screen.getAllByTestId('image')).toHaveLength(4)
        expect(screen.getByText('+8')).toBeInTheDocument()
        expect(screen.getAllByTestId('image')[0]).toHaveAttribute('data-src', 'https://img.test/p0_preview.jpg')
    })

    it('has no counter when every photo is shown', () => {
        render(<FeedPhotoMosaic photos={photos.slice(0, 2)} />)
        expect(screen.queryByText(/^\+/)).toBeNull()
    })

    it('opens the lightbox with all the photos at the clicked one', () => {
        render(<FeedPhotoMosaic photos={photos} />)

        fireEvent.click(screen.getByRole('button', { name: 'Фото 3' }))

        expect(screen.getByTestId('lightbox')).toHaveTextContent('2/8')
    })

    it('names the photos after the place and says how many are left on the last one', () => {
        render(
            <FeedPhotoMosaic
                photos={photos}
                total={12}
                placeTitle={'Усадьба'}
            />
        )

        expect(screen.getAllByTestId('image')[1]).toHaveAttribute('data-alt', 'Усадьба — фото 2')
        expect(screen.getByRole('button', { name: 'Усадьба — фото 4, ещё 8 фото' })).toBeInTheDocument()
    })
})
