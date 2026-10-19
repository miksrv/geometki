import React from 'react'

import { act, fireEvent, render, screen, within } from '@testing-library/react'

import { SiteSearch } from './SiteSearch'

import '@testing-library/jest-dom'

const translate = (key: string, fallback?: unknown, options?: Record<string, unknown>) => {
    const text =
        typeof fallback === 'string' ? fallback : ((fallback as { defaultValue?: string })?.defaultValue ?? key)
    const values = (typeof fallback === 'object' ? fallback : options) as Record<string, unknown> | undefined

    return text.replace(/{{(\w+)}}/g, (_, name: string) => String(values?.[name] ?? ''))
}

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ alt }: { alt: string }) => <img alt={alt} />
}))

jest.mock('next-i18next/pages', () => ({ useTranslation: () => ({ t: translate }) }))

const mockPush = jest.fn().mockResolvedValue(true)
const mockReplace = jest.fn().mockResolvedValue(true)
jest.mock('next/router', () => ({
    useRouter: () => ({ asPath: '/', pathname: '/', push: mockPush, query: {}, replace: mockReplace })
}))

const mockRequestLocation = jest.fn()
jest.mock('@/hooks/useUserLocation', () => ({
    __esModule: true,
    default: () => ({ request: mockRequestLocation })
}))

const mockSuggestions: Record<string, unknown[]> = {
    оренб: [
        {
            address: 'Оренбург, Оренбургская область',
            category: 'mountain',
            id: 'abc',
            slug: 'zmeinaya-gora',
            title: 'Змеиная гора (Оренбург)',
            type: 'place'
        },
        {
            id: 1,
            locationType: 'locality',
            placesCount: 98,
            region: 'Оренбургская область',
            slug: 'orenburg',
            title: 'Оренбург',
            type: 'area'
        }
    ],
    пусто: []
}

jest.mock('@/api', () => ({
    ...jest.requireActual('@/api'),
    API: {
        useLocationsGetChildrenQuery: (_: unknown, { skip }: { skip: boolean }) => ({
            data: skip
                ? undefined
                : {
                      items: [
                          {
                              id: 81,
                              placesCount: 294,
                              slug: 'orenburgskaya-oblast',
                              title: 'Оренбургская область',
                              type: 'region'
                          },
                          { id: 2, placesCount: 400, slug: 'bashkortostan', title: 'Башкортостан', type: 'region' }
                      ]
                  }
        }),
        useSearchSuggestQuery: (q: string, { skip }: { skip: boolean }) => ({
            data: skip ? undefined : { suggestions: mockSuggestions[q] ?? [] },
            isFetching: false
        })
    }
}))

// jsdom lays nothing out
Element.prototype.scrollIntoView = jest.fn()

const field = () => screen.getByRole('combobox')

const type = (value: string) => {
    fireEvent.change(field(), { target: { value } })
    act(() => {
        jest.advanceTimersByTime(300)
    })
}

const optionLabels = () => screen.getAllByRole('option').map((option) => option.textContent)

describe('SiteSearch', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        window.localStorage.clear()
        mockPush.mockClear()
        mockRequestLocation.mockReset()
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    it('shows no panel until the field is focused', () => {
        render(<SiteSearch />)

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
        expect(field()).toHaveAttribute('aria-expanded', 'false')
    })

    it('answers before anything is typed: places near me and the fullest regions first', () => {
        render(<SiteSearch />)
        fireEvent.focus(field())

        const labels = optionLabels()
        expect(labels[0]).toContain('Места рядом со мной')
        expect(labels[1]).toContain('Башкортостан')
        expect(labels[2]).toContain('Оренбургская область')
        expect(field()).toHaveAttribute('aria-expanded', 'true')
    })

    it('shows the recent searches with a way to clear them', () => {
        window.localStorage.setItem('site-search-recent', JSON.stringify([{ kind: 'query', label: 'водопад' }]))

        render(<SiteSearch />)
        fireEvent.focus(field())

        const recent = screen.getByRole('group', { name: 'Недавние' })
        expect(within(recent).getByRole('option')).toHaveAttribute(
            'href',
            '/search?q=%D0%B2%D0%BE%D0%B4%D0%BE%D0%BF%D0%B0%D0%B4'
        )

        fireEvent.click(within(recent).getByRole('button', { name: 'Очистить' }))
        expect(screen.queryByRole('group', { name: 'Недавние' })).not.toBeInTheDocument()
        expect(window.localStorage.getItem('site-search-recent')).toBe('[]')
    })

    it('asks for three characters', () => {
        render(<SiteSearch />)
        fireEvent.focus(field())
        type('ор')

        expect(screen.getByText('Введите хотя бы три символа')).toBeInTheDocument()
    })

    it('suggests the query itself, places and locations with the words of the query marked', () => {
        render(<SiteSearch />)
        fireEvent.focus(field())
        type('оренб')

        const labels = optionLabels()
        expect(labels[0]).toContain('Искать «оренб»')
        expect(labels[1]).toContain('Змеиная гора (Оренбург)')
        expect(labels[1]).toContain('Оренбург, Оренбургская область')
        expect(labels[2]).toContain('Оренбургская область · 98 мест')

        const place = screen.getAllByRole('option')[1]
        expect(place).toHaveAttribute('href', '/places/abc-zmeinaya-gora')
        expect(within(place).getByText('Оренб', { selector: 'mark' })).toBeInTheDocument()
    })

    it('says when there is nothing to suggest', () => {
        render(<SiteSearch />)
        fireEvent.focus(field())
        type('пусто')

        expect(screen.getByText('Подсказок нет — проверьте написание или введите координаты')).toBeInTheDocument()
    })

    it('moves over the rows with the arrows and opens the chosen one on Enter, remembering it', () => {
        render(<SiteSearch />)
        fireEvent.focus(field())
        type('оренб')

        fireEvent.keyDown(field(), { key: 'ArrowDown' })
        fireEvent.keyDown(field(), { key: 'ArrowDown' })

        const place = screen.getAllByRole('option')[1]
        expect(place).toHaveAttribute('aria-selected', 'true')
        expect(field()).toHaveAttribute('aria-activedescendant', place.id)

        fireEvent.keyDown(field(), { key: 'Enter' })

        expect(mockPush).toHaveBeenCalledWith('/places/abc-zmeinaya-gora')
        expect(JSON.parse(window.localStorage.getItem('site-search-recent') ?? '[]')[0]).toMatchObject({
            href: '/places/abc-zmeinaya-gora',
            kind: 'place',
            label: 'Змеиная гора (Оренбург)'
        })
    })

    it('goes round from the first row back to the field', () => {
        render(<SiteSearch />)
        fireEvent.focus(field())
        type('оренб')

        fireEvent.keyDown(field(), { key: 'ArrowUp' })
        expect(screen.getAllByRole('option').at(-1)).toHaveAttribute('aria-selected', 'true')

        fireEvent.keyDown(field(), { key: 'ArrowDown' })
        expect(field()).not.toHaveAttribute('aria-activedescendant')
    })

    it('opens the search page on Enter with no row chosen', () => {
        render(<SiteSearch />)
        fireEvent.focus(field())
        type('оренб')

        fireEvent.keyDown(field(), { key: 'Enter' })

        expect(mockPush).toHaveBeenCalledWith('/search?q=%D0%BE%D1%80%D0%B5%D0%BD%D0%B1')
    })

    it('closes the panel on Escape and opens it again on typing', () => {
        render(<SiteSearch />)
        fireEvent.focus(field())
        type('оренб')

        fireEvent.keyDown(field(), { key: 'Escape' })
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

        type('оренбу')
        expect(screen.getByRole('listbox')).toBeInTheDocument()
    })

    it('leaves a click with a modifier to the browser (a new tab)', () => {
        render(<SiteSearch />)
        fireEvent.focus(field())
        type('оренб')

        fireEvent.click(screen.getAllByRole('option')[1], { metaKey: true })

        expect(mockPush).not.toHaveBeenCalled()
        expect(window.localStorage.getItem('site-search-recent')).toContain('abc-zmeinaya-gora')
    })

    it('finds the places near the visitor after asking for the location', async () => {
        mockRequestLocation.mockResolvedValue({ lat: 51.77, lon: 55.1 })

        render(<SiteSearch />)
        fireEvent.focus(field())

        await act(async () => {
            fireEvent.click(screen.getByRole('option', { name: /Места рядом со мной/ }))
        })

        expect(mockPush).toHaveBeenCalledWith('/places?sort=distance&order=ASC')
    })

    it('clears the field with its button', () => {
        render(<SiteSearch />)
        fireEvent.focus(field())
        type('оренб')

        fireEvent.click(screen.getByRole('button', { name: 'Очистить поле' }))

        expect(field()).toHaveValue('')
    })
})
