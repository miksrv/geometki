import React from 'react'

import { render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'

import { CategoryIcon } from './CategoryIcon'

jest.mock('simple-react-ui-kit', () => ({
    Tooltip: ({ content, children }: any) => (
        <span
            data-testid={'tooltip'}
            data-content={content}
        >
            {children}
        </span>
    ),
    cn: (...args: unknown[]) => args.filter(Boolean).join(' ')
}))

jest.mock('next/image', () => {
    const Image = ({ src, alt, width, height }: any) => (
        <img
            src={src}
            alt={alt}
            width={width}
            height={height}
        />
    )
    Image.displayName = 'Image'
    return Image
})

jest.mock('next/link', () => {
    const Link = ({ href, children, className, ...rest }: any) => (
        <a
            href={href}
            className={className}
            aria-label={rest['aria-label']}
        >
            {children}
        </a>
    )
    Link.displayName = 'Link'
    return Link
})

jest.mock('@/utils/categories', () => ({
    categoryImage: (name: string) => ({ src: `/images/poi/${name}.png` })
}))

const category: ApiModel.Category = { name: 'cave' as ApiModel.Categories, title: 'Пещера' }

describe('CategoryIcon', () => {
    it('links to the places of the category, named after it', () => {
        render(<CategoryIcon category={category} />)

        const link = screen.getByRole('link', { name: 'Пещера' })
        expect(link).toHaveAttribute('href', '/places?category=cave')
        // The link carries the name, so the image inside is decorative
        expect(link.querySelector('img')).toHaveAttribute('alt', '')
        expect(link.querySelector('img')).toHaveAttribute('src', '/images/poi/cave.png')
    })

    it('shows the category name in a tooltip', () => {
        render(<CategoryIcon category={category} />)

        expect(screen.getByTestId('tooltip')).toHaveAttribute('data-content', 'Пещера')
    })

    it('renders the requested size, 20px by default', () => {
        const { container, rerender } = render(<CategoryIcon category={category} />)

        expect(container.querySelector('img')).toHaveAttribute('width', '20')

        rerender(
            <CategoryIcon
                category={category}
                size={40}
            />
        )

        expect(container.querySelector('img')).toHaveAttribute('width', '40')
    })

    it('renders a plain image named after the category when the link is off', () => {
        render(
            <CategoryIcon
                category={category}
                link={false}
            />
        )

        expect(screen.queryByRole('link')).not.toBeInTheDocument()
        expect(screen.getByRole('img', { name: 'Пещера' })).toBeInTheDocument()
    })
})
