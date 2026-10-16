import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { Search } from './Search'

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key })
}))

jest.mock('simple-react-ui-kit', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Button: ({ onClick, className, ...rest }: any) => (
        <button
            className={className}
            aria-label={rest['aria-label']}
            onClick={onClick}
        />
    )
}))

const mockFocus = jest.fn()
jest.mock('@/components/shared/site-search', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { forwardRef, useImperativeHandle } = require('react')

    return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        SiteSearch: forwardRef(({ variant, placeholder }: any, ref: any) => {
            useImperativeHandle(ref, () => ({ focus: mockFocus }))

            return (
                <input
                    data-testid={`site-search-${String(variant)}`}
                    placeholder={placeholder}
                />
            )
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        SiteSearchScreen: ({ open, onClose }: any) =>
            open ? (
                <div data-testid={'site-search-screen'}>
                    <button onClick={onClose}>{'close'}</button>
                </div>
            ) : null
    }
})

const setWideScreen = (wide: boolean) => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: wide }) as unknown as typeof window.matchMedia
}

describe('Search', () => {
    beforeEach(() => {
        mockFocus.mockClear()
        setWideScreen(true)
    })

    it('puts the field in the bar with the placeholder', () => {
        render(<Search />)

        expect(screen.getByTestId('site-search-bar')).toHaveAttribute('placeholder', 'Места, города, координаты')
    })

    it('opens the full-screen search from the icon button and closes it', () => {
        render(<Search />)

        fireEvent.click(screen.getByRole('button', { name: 'Места, города, координаты' }))
        expect(screen.getByTestId('site-search-screen')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'close' }))
        expect(screen.queryByTestId('site-search-screen')).not.toBeInTheDocument()
    })

    it('focuses the field on "/" on a wide screen', () => {
        render(<Search />)

        fireEvent.keyDown(document.body, { code: 'Slash', key: '/' })

        expect(mockFocus).toHaveBeenCalled()
        expect(screen.queryByTestId('site-search-screen')).not.toBeInTheDocument()
    })

    it('takes the slash key of any keyboard layout', () => {
        render(<Search />)

        fireEvent.keyDown(document.body, { code: 'Slash', key: '.' })

        expect(mockFocus).toHaveBeenCalled()
    })

    it('opens the full-screen search on Ctrl+K on a narrow screen', () => {
        setWideScreen(false)
        render(<Search />)

        fireEvent.keyDown(document.body, { code: 'KeyK', ctrlKey: true, key: 'k' })

        expect(screen.getByTestId('site-search-screen')).toBeInTheDocument()
    })

    it('leaves "/" typed into a text field alone', () => {
        render(
            <>
                <textarea data-testid={'comment'} />
                <Search />
            </>
        )

        fireEvent.keyDown(screen.getByTestId('comment'), { code: 'Slash', key: '/' })

        expect(mockFocus).not.toHaveBeenCalled()
    })
})
