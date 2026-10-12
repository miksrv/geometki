import React from 'react'

import Head from 'next/head'
import { useTheme } from 'next-themes'

import useClientOnly from '@/hooks/useClientOnly'

/**
 * Colour of the browser UI around the page (address bar, status bar of the installed app):
 * the app bar's background (`--container-background`) of the theme chosen on the site, so the
 * bar continues the page. The site does not follow the system theme by default (ThemeProvider
 * `defaultTheme="light"`), so `prefers-color-scheme` would paint a dark bar over a light page.
 */
export const THEME_COLORS = {
    dark: '#232426',
    light: '#ffffff'
} as const

export const ThemeColor: React.FC = () => {
    const isClient = useClientOnly()
    const { resolvedTheme } = useTheme()

    // The server and the first client render know only the default theme
    const color = isClient && resolvedTheme === 'dark' ? THEME_COLORS.dark : THEME_COLORS.light

    return (
        <Head>
            <meta
                key={'theme-color'}
                name={'theme-color'}
                content={color}
            />
        </Head>
    )
}
