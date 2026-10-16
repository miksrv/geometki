import React from 'react'

import { render, screen } from '@testing-library/react'

import { AppliedFilters } from './AppliedFilters'
import { PlacesFilterPatch, PlacesFilterState } from './types'

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

// Every href reads as the patch it was built from
const buildHref = (patch: PlacesFilterPatch) => `?${JSON.stringify(patch)}`

const base: PlacesFilterState = { categories: [], notVisited: false, sort: 'trending' }

describe('AppliedFilters', () => {
    it('renders nothing when nothing is applied', () => {
        const { container } = render(
            <AppliedFilters
                filter={base}
                defaultSort={'trending'}
                buildHref={buildHref}
            />
        )

        expect(container).toBeEmptyDOMElement()
    })

    it('shows a removable chip per filter and a reset link', () => {
        render(
            <AppliedFilters
                filter={{
                    ...base,
                    categories: ['cave'],
                    location: { id: 56, name: 'Оренбургская область', type: 'region' },
                    notVisited: true,
                    sort: 'rating'
                }}
                defaultSort={'trending'}
                buildHref={buildHref}
            />
        )

        expect(screen.getByRole('link', { name: 'Убрать фильтр: Оренбургская область' })).toHaveAttribute(
            'href',
            '?{"location":null}'
        )
        expect(screen.getByRole('link', { name: 'Убрать фильтр: Без посещённых' })).toHaveAttribute(
            'href',
            '?{"notVisited":false}'
        )
        expect(screen.getByRole('link', { name: 'Убрать фильтр: Лучший рейтинг' })).toHaveAttribute(
            'href',
            '?{"sort":"trending"}'
        )
        expect(screen.getByRole('link', { name: 'Сбросить всё' })).toBeInTheDocument()
        expect(screen.queryByRole('link', { name: /Продолжить/ })).not.toBeInTheDocument()
    })
})
