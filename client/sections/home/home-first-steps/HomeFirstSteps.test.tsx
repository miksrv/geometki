import React from 'react'

import { render, screen } from '@testing-library/react'

import type { ApiModel } from '@/api'

import { HomeFirstSteps, isNewcomer } from './HomeFirstSteps'

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({ i18n: { language: 'ru' }, t: (key: string) => key })
}))

const statistic = (values: Partial<ApiModel.UserStatistic> = {}): ApiModel.UserStatistic => ({
    comment: 0,
    edit: 0,
    photo: 0,
    place: 0,
    rating: 0,
    visited: 0,
    visits: 0,
    ...values
})

describe('isNewcomer', () => {
    it('is someone who has neither explored a place nor added one', () => {
        expect(isNewcomer(statistic())).toBe(true)
        expect(isNewcomer(statistic({ photo: 2, rating: 5 }))).toBe(true)
        expect(isNewcomer(statistic({ visited: 1 }))).toBe(false)
        expect(isNewcomer(statistic({ place: 1 }))).toBe(false)
    })

    it('is nobody while the statistic is not known: no steps instead of wrong ones', () => {
        expect(isNewcomer(undefined)).toBe(false)
    })
})

describe('HomeFirstSteps', () => {
    it('lists the three steps, each with its way in', () => {
        render(<HomeFirstSteps statistic={statistic()} />)

        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('home-steps-title')
        expect(screen.getAllByRole('listitem')).toHaveLength(3)
        expect(screen.getByText('home-steps-visit-button')).toBeInTheDocument()
        expect(screen.getByText('home-steps-photo-button')).toBeInTheDocument()
        expect(screen.getByText('home-steps-place-button')).toBeInTheDocument()
        expect(screen.queryByText('home-steps-done')).not.toBeInTheDocument()
    })

    it('ticks a step already done and offers no button for it', () => {
        render(<HomeFirstSteps statistic={statistic({ photo: 1 })} />)

        expect(screen.getByText('home-steps-done')).toBeInTheDocument()
        expect(screen.queryByText('home-steps-photo-button')).not.toBeInTheDocument()
        expect(screen.getByText('home-steps-visit-button')).toBeInTheDocument()
    })
})
