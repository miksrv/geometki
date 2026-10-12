import React from 'react'

import { render } from '@testing-library/react'

import useClientOnly from '@/hooks/useClientOnly'

import { THEME_COLORS, ThemeColor } from './ThemeColor'

let mockResolvedTheme: string | undefined = 'light'
jest.mock('next-themes', () => ({
    useTheme: () => ({ resolvedTheme: mockResolvedTheme })
}))

jest.mock('@/hooks/useClientOnly', () => jest.fn().mockReturnValue(true))

// Render the head tags in place so the test can read them
jest.mock('next/head', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

// React 19 hoists <meta> into document.head
const themeColorTags = () => document.querySelectorAll('meta[name="theme-color"]')
const themeColor = () => themeColorTags()[0]?.getAttribute('content')

describe('ThemeColor', () => {
    beforeEach(() => {
        mockResolvedTheme = 'light'
        ;(useClientOnly as jest.Mock).mockReturnValue(true)
    })

    it('uses the light app bar colour for the light theme', () => {
        render(<ThemeColor />)
        expect(themeColor()).toBe(THEME_COLORS.light)
    })

    it('uses the dark app bar colour for the dark theme', () => {
        mockResolvedTheme = 'dark'
        render(<ThemeColor />)
        expect(themeColor()).toBe(THEME_COLORS.dark)
    })

    it('renders the default (light) colour before the theme is known on the client', () => {
        mockResolvedTheme = 'dark'
        ;(useClientOnly as jest.Mock).mockReturnValue(false)
        render(<ThemeColor />)
        expect(themeColor()).toBe(THEME_COLORS.light)
    })

    it('renders a single theme-color tag without a media query', () => {
        render(<ThemeColor />)
        const tags = themeColorTags()
        expect(tags).toHaveLength(1)
        expect(tags[0].hasAttribute('media')).toBe(false)
    })
})
