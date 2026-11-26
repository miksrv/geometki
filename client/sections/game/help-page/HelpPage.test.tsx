import React from 'react'

import { render, screen } from '@testing-library/react'

import { ApiType } from '@/api'

import { HelpPage } from './HelpPage'

jest.mock('next/head', () => ({ __esModule: true, default: () => null }))
jest.mock('next-seo/pages', () => ({ generateNextSeo: () => null }))
jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({ i18n: { language: 'ru' }, t: (key: string) => key })
}))
jest.mock('@/config/env', () => ({ SITE_LINK: 'https://geometki.test/' }))
jest.mock('@/utils/seo', () => ({ buildHreflangTags: () => [] }))
jest.mock('@/components/shared', () => ({
    AppLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
    PageHeader: ({ title, breadcrumbs }: { title: string; breadcrumbs: Array<{ link: string; text: string }> }) => (
        <header>
            <a href={breadcrumbs[0].link}>{breadcrumbs[0].text}</a>
            <h1>{title}</h1>
        </header>
    ),
    Section: ({ title, children }: { title: string; children: React.ReactNode }) => (
        <section aria-label={title}>{children}</section>
    )
}))
jest.mock('../game-rules', () => ({ GamePointsTable: () => <div data-testid={'points-table'} /> }))

describe('HelpPage', () => {
    it('shows the text of the page, the table of points under it and the way into the game', () => {
        render(
            <HelpPage
                content={'<p>Это игра.</p><h2>Шаг 1. Выберите место</h2>'}
                rules={{ base: 10 } as ApiType.Game.Rules}
            />
        )

        expect(screen.getByRole('heading', { level: 1, name: 'game-rules-title' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'game-title' })).toHaveAttribute('href', '/game')
        expect(screen.getByRole('heading', { level: 2, name: 'Шаг 1. Выберите место' })).toBeInTheDocument()
        expect(screen.getByText('Это игра.')).toBeInTheDocument()
        expect(screen.getByTestId('points-table')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'game-help-start' })).toHaveAttribute('data-mode', 'primary')
    })

    it('has no table without the numbers', () => {
        render(<HelpPage content={'<p>Это игра.</p>'} />)

        expect(screen.queryByTestId('points-table')).not.toBeInTheDocument()
    })
})
