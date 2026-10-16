import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'

import { PlaceExplore } from './PlaceExplore'

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
    ScrollRail: ({ children, 'aria-label': label }: { children: React.ReactNode; 'aria-label'?: string }) => (
        <div
            role={'group'}
            aria-label={label}
        >
            {children}
        </div>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Tabs: ({ tabs, onChangeTab }: any) => (
        <nav>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {tabs.map((tab: any) => (
                <button
                    key={tab.key}
                    type={'button'}
                    onClick={() => onChangeTab(tab.key)}
                >
                    {tab.label}
                </button>
            ))}
        </nav>
    )
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
    getCategoryShortTitle: () => 'Инженерные сооружения'
}))

jest.mock('@/utils/helpers', () => ({
    buildPlacesHref: () => ({ href: '/places/kaluzhskaya-oblast/bridge' }),
    getLandingFlags: () => ({ categories: true, locations: true, combinations: true })
}))

const make = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, i) => ({
        id: `${prefix}${i}`,
        title: `${prefix} ${i}`,
        lat: 1,
        lon: 1
    })) as ApiModel.PlaceListItem[]

const location = { id: 7, name: 'Калужская область', slug: 'kaluzhskaya-oblast', type: 'region' as const }
const category = 'engineering' as ApiModel.Categories

describe('PlaceExplore', () => {
    it('renders nothing without places', () => {
        const { container } = render(
            <PlaceExplore
                nearPlaces={[]}
                relatedPlaces={make('Мост', 2)}
                category={category}
                location={location}
            />
        )

        expect(container).toBeEmptyDOMElement()
    })

    it('shows the nearby places first and keeps the related ones in the markup', () => {
        render(
            <PlaceExplore
                nearPlaces={make('Рядом', 2)}
                relatedPlaces={make('Мост', 3)}
                category={category}
                location={location}
                lat={1}
                lon={2}
            />
        )

        expect(screen.getByRole('heading')).toHaveTextContent('Что ещё посмотреть')
        expect(screen.getByRole('button', { name: 'Инженерные сооружения' })).toBeInTheDocument()
        expect(screen.getByText('Рядом 0').closest('[hidden]')).toBeNull()
        // Hidden, but still links for crawlers
        expect(screen.getByText('Мост 0').closest('div[hidden]')).not.toBeNull()
        expect(screen.getByRole('link', { name: 'all-places-nearby' })).toHaveAttribute(
            'href',
            '/places?lat=1&lon=2&sort=distance&order=ASC'
        )
    })

    it('switches to the region tab with the link to its landing page', () => {
        render(
            <PlaceExplore
                nearPlaces={make('Рядом', 2)}
                relatedPlaces={make('Мост', 3)}
                category={category}
                location={location}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: 'Инженерные сооружения' }))

        expect(screen.getByText('Мост 0').closest('div[hidden]')).toBeNull()
        expect(screen.getByRole('link', { name: 'Все — Калужская область' })).toHaveAttribute(
            'href',
            '/places/kaluzhskaya-oblast/bridge'
        )
    })

    it('drops the switch when the region has too few places', () => {
        render(
            <PlaceExplore
                nearPlaces={make('Рядом', 2)}
                relatedPlaces={make('Мост', 2)}
                category={category}
                location={location}
            />
        )

        expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
        expect(screen.queryByText('Мост 0')).not.toBeInTheDocument()
    })
})
