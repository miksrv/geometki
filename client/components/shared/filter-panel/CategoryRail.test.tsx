import React from 'react'

import { render, screen } from '@testing-library/react'

import { CategoryRail } from './CategoryRail'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
    Icon: ({ name }: { name: string }) => <i data-testid={`icon-${name}`} />
}))

jest.mock('next/image', () => {
    const Image = ({ alt }: any) => <img alt={alt} />
    Image.displayName = 'Image'
    return Image
})

jest.mock('next/link', () => {
    const Link = ({ href, children, ...props }: any) => (
        <a
            href={href}
            {...props}
        >
            {children}
        </a>
    )
    Link.displayName = 'Link'
    return Link
})

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue?: string | Record<string, unknown>, options?: Record<string, unknown>) =>
            typeof defaultValue === 'string'
                ? defaultValue.replace(/{{(\w+)}}/g, (_, name) => String(options?.[name] ?? ''))
                : key
    })
}))

// Every href reads as the categories it was built from
const hrefFor = (categories: string[]) => `?${JSON.stringify(categories)}`

describe('CategoryRail', () => {
    it('toggles a category in the link of its chip and keeps the others', () => {
        render(
            <CategoryRail
                selected={['cave']}
                hrefFor={hrefFor}
            />
        )

        const links = screen.getAllByRole('link')
        const cave = links.find((link) => link.getAttribute('aria-current') === 'true')

        expect(cave).toHaveAttribute('href', '?[]')
        expect(links[0]).toHaveAttribute('href', '?[]')
        expect(links.some((link) => link.getAttribute('href') === '?["cave","mountain"]')).toBe(true)
    })

    it('shows only the categories of the facets, and those on, with their numbers', () => {
        render(
            <CategoryRail
                selected={['castle']}
                counts={{ cave: 4, waterfall: 2 }}
                total={6}
                hrefFor={hrefFor}
            />
        )

        const links = screen.getAllByRole('link')

        expect(links).toHaveLength(4)
        expect(links[0]).toHaveTextContent('6')
        expect(links.find((link) => link.getAttribute('href') === '?["castle","cave"]')).toHaveTextContent('4')
        expect(links.find((link) => link.getAttribute('aria-current') === 'true')).toHaveTextContent('0')
    })
})
