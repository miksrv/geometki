import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

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

const mockPush = jest.fn()

jest.mock('next/router', () => ({
    useRouter: () => ({ push: mockPush })
}))

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
    beforeEach(() => mockPush.mockClear())

    it('links the chips that lead to one category or none', () => {
        render(
            <CategoryRail
                selected={[]}
                hrefFor={hrefFor}
            />
        )

        const links = screen.getAllByRole('link')

        expect(links[0]).toHaveAttribute('href', '?[]')
        expect(links.some((link) => link.getAttribute('href') === '?["cave"]')).toBe(true)
        expect(screen.queryAllByRole('button')).toHaveLength(0)
    })

    it('makes the chips that lead to 2+ categories buttons, not links for crawlers', () => {
        render(
            <CategoryRail
                selected={['cave']}
                hrefFor={hrefFor}
                shallow={true}
            />
        )

        const links = screen.getAllByRole('link')

        // "Все" and the chip that turns "cave" off
        expect(links).toHaveLength(2)
        expect(links.find((link) => link.getAttribute('aria-current') === 'true')).toHaveAttribute('href', '?[]')

        fireEvent.click(screen.getByRole('button', { name: 'mountain' }))

        expect(mockPush).toHaveBeenCalledWith('?["cave","mountain"]', undefined, { scroll: false, shallow: true })
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
        const buttons = screen.getAllByRole('button')

        expect(links).toHaveLength(2)
        expect(buttons).toHaveLength(2)
        expect(links[0]).toHaveTextContent('6')
        expect(links.find((link) => link.getAttribute('aria-current') === 'true')).toHaveTextContent('0')
        expect(buttons[0]).toHaveTextContent('4')
    })
})
