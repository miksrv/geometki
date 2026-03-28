import React from 'react'

import { render, screen } from '@testing-library/react'

import { MapLinks } from './MapLinks'

jest.mock('next/link', () => {
    const Link = ({ href, children, target, title }: any) => (
        <a
            href={href}
            target={target}
            title={title}
        >
            {children}
        </a>
    )
    Link.displayName = 'Link'
    return Link
})

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

jest.mock('next-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: 'ru' }
    })
}))

// Map static image imports to plain objects
jest.mock('@/public/images/google-logo.png', () => ({ src: '/google-logo.png' }), { virtual: true })
jest.mock('@/public/images/yandex-logo.png', () => ({ src: '/yandex-logo.png' }), { virtual: true })
jest.mock('@/public/images/wikimapia-logo.png', () => ({ src: '/wikimapia-logo.png' }), { virtual: true })

const coords = { lat: 55.75, lon: 37.62 }

describe('MapLinks', () => {
    describe('default (non-list) rendering', () => {
        it('renders 3 service links', () => {
            render(<MapLinks {...coords} />)
            expect(screen.getAllByRole('link').length).toBeGreaterThanOrEqual(3)
        })

        it('each link opens in a new tab', () => {
            render(<MapLinks {...coords} />)
            const links = screen.getAllByRole('link')
            links.forEach((link) => expect(link).toHaveAttribute('target', '_blank'))
        })

        it('Yandex link contains the correct coordinates', () => {
            render(<MapLinks {...coords} />)
            const links = screen.getAllByRole('link')
            const yandexLink = links.find((l) => (l as HTMLAnchorElement).href.includes('yandex'))
            expect(yandexLink).toBeTruthy()
            expect((yandexLink as HTMLAnchorElement).href).toContain('55.75')
            expect((yandexLink as HTMLAnchorElement).href).toContain('37.62')
        })

        it('Google link contains the correct coordinates', () => {
            render(<MapLinks {...coords} />)
            const links = screen.getAllByRole('link')
            const googleLink = links.find((l) => (l as HTMLAnchorElement).href.includes('google'))
            expect(googleLink).toBeTruthy()
            expect((googleLink as HTMLAnchorElement).href).toContain('55.75')
        })
    })

    describe('asListItem rendering', () => {
        it('wraps each link inside a list item when asListItem is true', () => {
            const { container } = render(
                <MapLinks
                    {...coords}
                    asListItem
                />
            )
            const listItems = container.querySelectorAll('li')
            expect(listItems).toHaveLength(3)
        })
    })

    describe('showTitle prop', () => {
        it('shows the caption text when showTitle is true', () => {
            render(
                <MapLinks
                    {...coords}
                    showTitle
                />
            )
            // The i18n mock returns the key as the value
            expect(screen.getByText('map-link-on-Yandex')).toBeInTheDocument()
        })
    })
})
