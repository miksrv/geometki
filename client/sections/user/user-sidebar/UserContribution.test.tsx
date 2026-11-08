import React from 'react'

import { render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'

import { UserContribution } from './UserContribution'

jest.mock('simple-react-ui-kit', () => ({ Icon: () => null }))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}))

jest.mock('@/components/shared', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Section: ({ title, children }: any) => (
        <section>
            <h3>{title}</h3>
            {children}
        </section>
    )
}))

const statistic = {
    comment: 3,
    edit: 1240,
    photo: 0,
    place: 0,
    rating: 15,
    visited: 2,
    visits: 4
} as ApiModel.UserStatistic

describe('UserContribution', () => {
    it('lists the ratings, reviews and edits, not the check-ins', () => {
        render(<UserContribution statistic={statistic} />)

        expect(screen.getByRole('heading')).toHaveTextContent('user-side-contribution')
        expect(screen.getAllByRole('listitem').map((row) => row.textContent)).toStrictEqual([
            'user-side-ratings15',
            'user-side-reviews3',
            'user-side-edits1\u00a0240'
        ])
    })

    it('renders nothing while there is no contribution', () => {
        const { container } = render(<UserContribution statistic={{ ...statistic, comment: 0, edit: 0, rating: 0 }} />)

        expect(container).toBeEmptyDOMElement()
    })
})
