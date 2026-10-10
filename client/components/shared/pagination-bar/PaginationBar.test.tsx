import React from 'react'

import { render, screen } from '@testing-library/react'

import { PaginationBar } from './PaginationBar'

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue?: string | Record<string, unknown>, options?: Record<string, unknown>) => {
            const template = typeof defaultValue === 'string' ? defaultValue : key
            const values = (typeof defaultValue === 'object' ? defaultValue : options) ?? {}

            return template.replace(/{{(\w+)}}/g, (_, name) => String(values[name] ?? ''))
        }
    })
}))

jest.mock('@/components/ui', () => ({
    Pagination: ({
        currentPage,
        totalItemsCount,
        perPage
    }: {
        currentPage: number
        totalItemsCount: number
        perPage: number
    }) => <nav aria-label={'pagination'}>{`${currentPage}/${Math.ceil(totalItemsCount / perPage)}`}</nav>
}))

describe('PaginationBar', () => {
    it('renders nothing when everything fits on one page', () => {
        const { container } = render(
            <PaginationBar
                currentPage={1}
                totalItemsCount={21}
                perPage={21}
            />
        )
        expect(container).toBeEmptyDOMElement()
    })

    it('shows the range of this page and the page links', () => {
        render(
            <PaginationBar
                currentPage={2}
                totalItemsCount={50}
                perPage={21}
            />
        )

        expect(screen.getByText('22–42 of 50')).toBeInTheDocument()
        expect(screen.getByRole('navigation', { name: 'pagination' })).toHaveTextContent('2/3')
    })

    it('clips the range to the total on the last page', () => {
        render(
            <PaginationBar
                currentPage={3}
                totalItemsCount={50}
                perPage={21}
            />
        )

        expect(screen.getByText('43–50 of 50')).toBeInTheDocument()
    })
})
