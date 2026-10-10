import React from 'react'

import { render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'

import { RelatedPlaces } from './RelatedPlaces'

jest.mock('simple-react-ui-kit', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Button: ({ label, link }: any) => <a href={link}>{label}</a>
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => {
            const value = (opts?.defaultValue as string) ?? key

            return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, name) => String(opts?.[name] ?? ''))
        }
    })
}))

jest.mock('@/components/ui', () => ({
    Carousel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

jest.mock('@/components/shared', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PlaceCard: ({ place }: any) => <article>{place.title}</article>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Section: ({ title, action, children }: any) => (
        <section>
            <h2>{title}</h2>
            {action}
            {children}
        </section>
    )
}))

jest.mock('@/utils/categories', () => ({
    getCategoryLandingTitle: () => 'Мосты'
}))

jest.mock('@/utils/helpers', () => ({
    buildPlacesHref: () => ({ href: '/places/kaluzhskaya-oblast/bridge' }),
    getLandingFlags: () => ({ categories: true, locations: true, combinations: true })
}))

const places = [
    { id: 'p1', title: 'Мост один', lat: 1, lon: 1 },
    { id: 'p2', title: 'Мост два', lat: 1, lon: 1 },
    { id: 'p3', title: 'Мост три', lat: 1, lon: 1 }
] as ApiModel.PlaceListItem[]

const location = { id: 7, name: 'Калужская область', slug: 'kaluzhskaya-oblast', type: 'region' as const }

describe('RelatedPlaces', () => {
    it('renders nothing with fewer than three places or without a category', () => {
        const { container } = render(
            <RelatedPlaces
                places={places.slice(0, 2)}
                category={'bridge' as ApiModel.Categories}
                location={location}
            />
        )
        expect(container).toBeEmptyDOMElement()

        const { container: noCategory } = render(
            <RelatedPlaces
                places={places}
                location={location}
            />
        )
        expect(noCategory).toBeEmptyDOMElement()
    })

    it('titles the block with the category and the region and links to the landing page', () => {
        render(
            <RelatedPlaces
                places={places}
                category={'bridge' as ApiModel.Categories}
                location={location}
            />
        )

        expect(screen.getByRole('heading', { name: 'Ещё мосты: Калужская область' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Все' })).toHaveAttribute('href', '/places/kaluzhskaya-oblast/bridge')
        expect(screen.getAllByRole('article')).toHaveLength(3)
    })

    it('falls back to "nearby" without a location', () => {
        render(
            <RelatedPlaces
                places={places}
                category={'bridge' as ApiModel.Categories}
            />
        )

        expect(screen.getByRole('heading', { name: 'Ещё мосты рядом' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Все' })).toBeInTheDocument()
    })
})
