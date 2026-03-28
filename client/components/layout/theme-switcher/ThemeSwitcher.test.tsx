import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock next-themes
const mockSetTheme = jest.fn()
let mockTheme = 'light'
jest.mock('next-themes', () => ({
    useTheme: () => ({
        theme: mockTheme,
        setTheme: mockSetTheme
    })
}))

// Mock useClientOnly — return true by default so the button renders
jest.mock('@/hooks/useClientOnly', () => jest.fn().mockReturnValue(true))

// Mock simple-react-ui-kit Button
jest.mock('simple-react-ui-kit', () => ({
    Button: ({ icon, onClick }: any) => (
        <button data-testid={'theme-button'} data-icon={icon} onClick={onClick}>
            toggle
        </button>
    )
}))

import { ThemeSwitcher } from './ThemeSwitcher'

describe('ThemeSwitcher', () => {
    beforeEach(() => {
        mockTheme = 'light'
        mockSetTheme.mockClear()
    })

    describe('client-side rendering', () => {
        it('renders the toggle button when on client', () => {
            render(<ThemeSwitcher />)
            expect(screen.getByTestId('theme-button')).toBeInTheDocument()
        })

        it('uses Moon icon in light mode', () => {
            render(<ThemeSwitcher />)
            expect(screen.getByTestId('theme-button')).toHaveAttribute('data-icon', 'Moon')
        })

        it('uses Sun icon in dark mode', () => {
            mockTheme = 'dark'
            render(<ThemeSwitcher />)
            expect(screen.getByTestId('theme-button')).toHaveAttribute('data-icon', 'Sun')
        })
    })

    describe('interaction', () => {
        it('switches from light to dark when clicked', () => {
            mockTheme = 'light'
            render(<ThemeSwitcher />)
            fireEvent.click(screen.getByTestId('theme-button'))
            expect(mockSetTheme).toHaveBeenCalledWith('dark')
        })

        it('switches from dark to light when clicked', () => {
            mockTheme = 'dark'
            render(<ThemeSwitcher />)
            fireEvent.click(screen.getByTestId('theme-button'))
            expect(mockSetTheme).toHaveBeenCalledWith('light')
        })
    })

    describe('SSR guard', () => {
        it('renders null when not on client', () => {
            // Override the useClientOnly mock to return false for this test
            const useClientOnly = require('@/hooks/useClientOnly')
            useClientOnly.mockReturnValueOnce(false)
            const { container } = render(<ThemeSwitcher />)
            expect(container.firstChild).toBeNull()
        })
    })
})
