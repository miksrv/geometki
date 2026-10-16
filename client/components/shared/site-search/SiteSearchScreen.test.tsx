import React from 'react'

import { render, screen } from '@testing-library/react'

import { SiteSearchScreen } from './SiteSearchScreen'

const mockRouter = { asPath: '/', pathname: '/', push: jest.fn(), query: {}, replace: jest.fn() }

jest.mock('next/router', () => ({
    useRouter: () => mockRouter
}))

jest.mock('./SiteSearch', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SiteSearch: ({ variant, placeholder }: any) => (
        <input
            data-testid={`site-search-${String(variant)}`}
            placeholder={placeholder}
        />
    )
}))

describe('SiteSearchScreen', () => {
    beforeEach(() => {
        mockRouter.asPath = '/'
        document.body.style.overflow = ''
    })

    it('stays open when mounted already open', () => {
        const onClose = jest.fn()

        render(
            <SiteSearchScreen
                open={true}
                placeholder={'Места'}
                onClose={onClose}
            />
        )

        expect(screen.getByRole('dialog', { name: 'Места' })).toBeInTheDocument()
        expect(screen.getByTestId('site-search-screen')).toBeInTheDocument()
        expect(onClose).not.toHaveBeenCalled()
        expect(document.body.style.overflow).toBe('hidden')
    })

    it('closes on a navigation to another page', () => {
        const onClose = jest.fn()

        const { rerender } = render(
            <SiteSearchScreen
                open={true}
                onClose={onClose}
            />
        )

        expect(onClose).not.toHaveBeenCalled()

        mockRouter.asPath = '/places/1'
        rerender(
            <SiteSearchScreen
                open={true}
                onClose={onClose}
            />
        )

        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('renders nothing while closed and gives the page its scroll back', () => {
        const onClose = jest.fn()

        const { rerender } = render(
            <SiteSearchScreen
                open={true}
                onClose={onClose}
            />
        )

        rerender(
            <SiteSearchScreen
                open={false}
                onClose={onClose}
            />
        )

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(document.body.style.overflow).toBe('')
    })
})
