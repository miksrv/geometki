import React from 'react'
import dayjs from 'dayjs'

import { render, screen } from '@testing-library/react'

import { ContributionSummary } from './ContributionSummary'

import 'dayjs/locale/ru'

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        i18n: { language: 'ru' },
        t: (key: string, opts?: Record<string, unknown>) => {
            if (opts?.date) {
                return `${key}:${String(opts.date)}:${String(opts.actions)}`
            }
            return opts?.count !== undefined ? `${key}:${String(opts.count)}` : key
        }
    })
}))

dayjs.locale('ru')

const calendar = {
    from: '2025-10-14',
    items: [
        { count: 2, date: '2026-10-11' },
        { count: 5, date: '2026-10-12' },
        { count: 1, date: '2026-10-13' }
    ],
    to: '2026-10-13',
    total: 8
}

describe('ContributionSummary', () => {
    it('renders nothing without data or for an empty year', () => {
        const { container, rerender } = render(<ContributionSummary />)
        expect(container).toBeEmptyDOMElement()

        rerender(<ContributionSummary calendar={{ ...calendar, items: [], total: 0 }} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('shows the totals, the runs of days and the busiest day', () => {
        render(<ContributionSummary calendar={calendar} />)

        expect(screen.getByRole('heading')).toHaveTextContent('calendar-summary-title')
        expect(screen.getByText('calendar-summary-actions:8')).toBeInTheDocument()
        expect(screen.getByText('calendar-summary-days:3')).toBeInTheDocument()
        expect(screen.getByText('calendar-summary-longest:3')).toBeInTheDocument()
        expect(screen.getByText('calendar-summary-current:3')).toBeInTheDocument()
        expect(screen.getByText('calendar-summary-busiest:12 октября:calendar-actions:5')).toBeInTheDocument()
    })
})
