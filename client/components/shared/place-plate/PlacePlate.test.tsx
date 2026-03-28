import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('simple-react-ui-kit', () => ({
    Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />
}))

import { PlacePlate } from './PlacePlate'

describe('PlacePlate', () => {
    describe('rendering', () => {
        it('renders without crashing', () => {
            const { container } = render(<PlacePlate />)
            expect(container.firstChild).toBeInTheDocument()
        })

        it('renders an icon when icon prop is provided', () => {
            render(<PlacePlate icon={'StarEmpty'} />)
            expect(screen.getByTestId('icon-StarEmpty')).toBeInTheDocument()
        })

        it('does not render an icon when icon is not provided', () => {
            render(<PlacePlate />)
            expect(screen.queryByTestId(/icon-/)).not.toBeInTheDocument()
        })

        it('renders children content', () => {
            render(<PlacePlate>4.5</PlacePlate>)
            expect(screen.getByText('4.5')).toBeInTheDocument()
        })

        it('renders content prop when children is not provided', () => {
            render(<PlacePlate content={'12 km'} />)
            expect(screen.getByText('12 km')).toBeInTheDocument()
        })

        it('prefers children over content prop', () => {
            render(<PlacePlate content={'content value'}>children value</PlacePlate>)
            // children is rendered as it appears first in the OR expression
            expect(screen.getByText('children value')).toBeInTheDocument()
        })

        it('renders icon alongside content', () => {
            render(<PlacePlate icon={'Ruler'} content={'500 m'} />)
            expect(screen.getByTestId('icon-Ruler')).toBeInTheDocument()
            expect(screen.getByText('500 m')).toBeInTheDocument()
        })
    })
})
