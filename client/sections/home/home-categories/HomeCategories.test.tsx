import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { ApiModel, ApiType } from '@/api'

import { HomeCategories } from './HomeCategories'

jest.mock('simple-react-ui-kit', () => ({
    Button: ({ label, onClick }: any) => <button onClick={onClick}>{label}</button>,
    cn: (...args: unknown[]) => args.filter(Boolean).join(' ')
}))

jest.mock('next/image', () => {
    const Image = ({ alt }: any) => <img alt={alt} />
    Image.displayName = 'Image'
    return Image
})

jest.mock('next/link', () => {
    const Link = ({ href, children, className }: any) => (
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

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: { count?: number }) => (opts?.count !== undefined ? `${key}:${opts.count}` : key)
    })
}))

jest.mock('@/components/shared', () => ({
    Section: ({ title, action, children }: any) => (
        <section>
            <h2>{title}</h2>
            {action}
            {children}
        </section>
    )
}))

jest.mock('@/utils/categories', () => ({
    categoryImage: () => ({ src: '/icon.png' }),
    getCategoryShortTitle: (_t: unknown, name: string) => `short:${name}`
}))

jest.mock('@/utils/helpers', () => ({
    buildCategoryHref: (name: string) => `/places?category=${name}`,
    getLandingFlags: () => ({ categories: false, combinations: false, locations: false })
}))

const make = (count: number): ApiType.Stats.CategoryCount[] =>
    Object.values(ApiModel.Categories)
        .slice(0, count)
        .map((name, index) => ({ count: 100 - index, name }))

describe('HomeCategories', () => {
    it('renders nothing without categories', () => {
        const { container } = render(<HomeCategories categories={[]} />)

        expect(container).toBeEmptyDOMElement()
    })

    it('links every category with its count, hiding all but twelve until expanded', () => {
        const categories = make(15)
        const { container } = render(<HomeCategories categories={categories} />)

        // Hidden tiles stay in the markup, so every category page is linked from the home page
        expect(screen.getAllByRole('link')).toHaveLength(15)
        expect(container.querySelectorAll('li.hidden')).toHaveLength(3)
        expect(screen.getByRole('link', { name: /short:mountain/ })).toHaveAttribute(
            'href',
            '/places?category=mountain'
        )
        expect(screen.getByText('home-places-count:100')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'home-categories-all:15' }))

        expect(container.querySelectorAll('li.hidden')).toHaveLength(0)
        expect(screen.getByRole('button', { name: 'home-categories-collapse' })).toBeInTheDocument()
    })

    it('has no expand control when everything fits', () => {
        render(<HomeCategories categories={make(5)} />)

        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
})
