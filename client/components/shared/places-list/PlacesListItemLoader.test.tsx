import React from 'react'

import { render, screen } from '@testing-library/react'

import { PlacesListItemLoader } from './PlacesListItemLoader'

jest.mock('simple-react-ui-kit', () => ({
    Skeleton: ({ style }: any) => (
        <div
            data-testid={'skeleton'}
            style={style}
        />
    )
}))

describe('PlacesListItemLoader', () => {
    describe('rendering', () => {
        it('renders an article element', () => {
            render(<PlacesListItemLoader />)
            expect(screen.getByRole('article')).toBeInTheDocument()
        })

        it('renders multiple skeleton elements for loading state', () => {
            render(<PlacesListItemLoader />)
            // 1 photo section skeleton + 7 content skeletons = 8
            expect(screen.getAllByTestId('skeleton').length).toBeGreaterThanOrEqual(7)
        })
    })
})
