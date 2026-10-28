import React from 'react'

import { render, screen } from '@testing-library/react'

import { PlaceNow } from './PlaceNow'

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) =>
            opts && Object.keys(opts).length
                ? `${key}|${Object.entries(opts)
                      .filter(([name]) => name !== 'defaultValue')
                      .map(([name, value]) => `${name}=${String(value)}`)
                      .join(',')}`
                : key
    })
}))

let mockData: unknown

jest.mock('@/api', () => ({
    API: { useVisitsGetListQuery: () => ({ data: mockData }) }
}))

describe('PlaceNow', () => {
    it('renders nothing without answers', () => {
        mockData = { count: 1, items: [] }

        const { container } = render(<PlaceNow placeId={'p1'} />)

        expect(container).toBeEmptyDOMElement()
    })

    it('shows the latest value, the agreement and the earlier years', () => {
        mockData = {
            count: 3,
            items: [],
            now: [
                {
                    agree: 5,
                    history: [{ value: 'offroad', year: 2023 }],
                    question: 'road',
                    total: 6,
                    value: 'dirt',
                    visitedAt: '2026-10-13'
                }
            ]
        }

        render(<PlaceNow placeId={'p1'} />)

        expect(screen.getByText('visitQuestions.road.title')).toBeInTheDocument()
        expect(screen.getByText(/visitQuestions\.road\.values\.dirt/)).toBeInTheDocument()
        expect(screen.getByText(/place-now-agree\|agree=5,total=6/)).toBeInTheDocument()
        expect(
            screen.getByText(/place-now-history\|value=visitQuestions\.road\.values\.offroad,year=2023/)
        ).toBeInTheDocument()
    })

    it('groups the features into "can" and "cannot" rows with the latest day and the agreement in the title', () => {
        mockData = {
            count: 3,
            items: [],
            now: [
                { agree: 3, history: [], question: 'can_swim', total: 4, value: 'yes', visitedAt: '2026-10-01' },
                { agree: 2, history: [], question: 'can_fish', total: 2, value: 'yes', visitedAt: '2026-10-13' },
                { agree: 1, history: [], question: 'can_fire', total: 1, value: 'no', visitedAt: '2026-09-20' }
            ]
        }

        const { container } = render(<PlaceNow placeId={'p1'} />)

        expect(screen.getByText('visitQuestions.can.title')).toBeInTheDocument()
        expect(screen.getByText(/place-now-cannot/)).toBeInTheDocument()
        expect(screen.getByText('visitFeatures.swim')).toHaveAttribute('title', 'place-now-agree|agree=3,total=4')
        expect(screen.getByText('visitFeatures.fish')).toHaveAttribute('title', 'place-now-agree|agree=2,total=2')
        expect(screen.getByText('visitFeatures.fire')).toHaveAttribute('title', 'place-now-agree|agree=1,total=1')
        // One quiet line per row, no history
        expect(container.querySelectorAll('p')).toHaveLength(4)
        expect(screen.queryByText(/place-now-history/)).not.toBeInTheDocument()
    })
})
