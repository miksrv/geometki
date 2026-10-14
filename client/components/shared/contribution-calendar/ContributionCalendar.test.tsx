import React from 'react'
import dayjs from 'dayjs'

import { render, screen } from '@testing-library/react'

import { ContributionCalendar } from './ContributionCalendar'

import 'dayjs/locale/ru'

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        i18n: { language: 'ru' },
        t: (key: string, opts?: Record<string, unknown>) =>
            opts?.count !== undefined ? `${key}:${String(opts.count)}` : key
    })
}))

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Container: ({ title, action, children }: any) => (
        <section>
            <h2>{title}</h2>
            <div>{action}</div>
            {children}
        </section>
    )
}))

const calendar = {
    from: '2025-10-14',
    items: [
        { count: 3, date: '2026-10-01' },
        { count: 12, date: '2026-10-13' }
    ],
    to: '2026-10-13',
    total: 15
}

dayjs.locale('ru')

describe('ContributionCalendar', () => {
    it('renders nothing without data', () => {
        const { container } = render(<ContributionCalendar />)
        expect(container).toBeEmptyDOMElement()
    })

    it('shows the title and the total for the year', () => {
        render(<ContributionCalendar calendar={calendar} />)

        expect(screen.getByRole('heading')).toHaveTextContent('calendar-title')
        expect(screen.getByRole('img')).toHaveAccessibleName('calendar-title: calendar-actions:15')
    })

    it('colours the days by how much was done', () => {
        const { container } = render(<ContributionCalendar calendar={calendar} />)

        const busiest = container.querySelector('[title^="calendar-actions:12"]')
        const quieter = container.querySelector('[title^="calendar-actions:3"]')

        expect(busiest).toHaveAttribute('data-level', '4')
        expect(quieter).toHaveAttribute('data-level', '1')
        expect(container.querySelectorAll('[title^="calendar-no-actions"]').length).toBeGreaterThan(300)
    })
})
