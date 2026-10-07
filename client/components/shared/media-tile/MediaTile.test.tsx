import React from 'react'

import { render, screen } from '@testing-library/react'

import { MediaTile, MediaTileGrid } from './MediaTile'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' ')
}))

jest.mock('next/image', () => {
    const Image = ({ src, alt }: any) => (
        <img
            src={src}
            alt={alt}
        />
    )
    Image.displayName = 'Image'
    return Image
})

jest.mock('next/link', () => {
    const Link = ({ href, title, children, className }: any) => (
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

describe('MediaTile', () => {
    it('renders an article with a full-card link to the entity', () => {
        render(
            <MediaTile
                href={'/places/p1'}
                title={'Cool Cave'}
            >
                <span>bottom</span>
            </MediaTile>
        )

        expect(screen.getByRole('article')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Cool Cave' })).toHaveAttribute('href', '/places/p1')
        expect(screen.getByText('bottom')).toBeInTheDocument()
    })

    it('shows the cover only when a source is given', () => {
        const { rerender } = render(
            <MediaTile
                href={'/places/p1'}
                title={'Cool Cave'}
            />
        )

        expect(screen.queryByRole('img')).not.toBeInTheDocument()

        rerender(
            <MediaTile
                href={'/places/p1'}
                title={'Cool Cave'}
                coverSrc={'https://img.test/cover.jpg'}
            />
        )

        expect(screen.getByRole('img')).toHaveAttribute('src', 'https://img.test/cover.jpg')
    })

    it('draws up to four covers as a mosaic and prefers it over coverSrc', () => {
        const { container } = render(
            <MediaTile
                href={'/collections/c1'}
                title={'Lakes'}
                coverSrc={'https://img.test/single.jpg'}
                covers={[
                    'https://img.test/1.jpg',
                    'https://img.test/2.jpg',
                    'https://img.test/3.jpg',
                    'https://img.test/4.jpg',
                    'https://img.test/5.jpg'
                ]}
            />
        )

        const images = container.querySelectorAll('img')

        expect(images).toHaveLength(4)
        expect(images[0]).toHaveAttribute('src', 'https://img.test/1.jpg')
        expect(container.querySelector('[data-count="4"]')).toBeInTheDocument()
        expect(container.querySelector('img[src="https://img.test/single.jpg"]')).not.toBeInTheDocument()
    })

    it('falls back to coverSrc when the covers list is empty', () => {
        render(
            <MediaTile
                href={'/collections/c1'}
                title={'Lakes'}
                coverSrc={'https://img.test/single.jpg'}
                covers={[]}
            />
        )

        expect(screen.getByRole('img')).toHaveAttribute('src', 'https://img.test/single.jpg')
    })

    it('renders the top band only when there is content for it', () => {
        const { container, rerender } = render(
            <MediaTile
                href={'/places/p1'}
                title={'Cool Cave'}
            />
        )

        expect(container.querySelectorAll('article > div')).toHaveLength(1)

        rerender(
            <MediaTile
                href={'/places/p1'}
                title={'Cool Cave'}
                top={<span>author</span>}
            />
        )

        expect(screen.getByText('author')).toBeInTheDocument()
        expect(container.querySelectorAll('article > div')).toHaveLength(2)
    })

    it('MediaTileGrid wraps tiles in a section', () => {
        render(
            <MediaTileGrid>
                <span>tile</span>
            </MediaTileGrid>
        )

        expect(screen.getByText('tile').closest('section')).toBeInTheDocument()
    })
})
