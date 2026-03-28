import React from 'react'

import { render, screen } from '@testing-library/react'

import { ScreenSpinner } from './ScreenSpinner'

jest.mock('simple-react-ui-kit', () => ({
    Spinner: () => <div data-testid={'spinner'} />
}))

describe('ScreenSpinner', () => {
    describe('rendering', () => {
        it('renders the spinner', () => {
            render(<ScreenSpinner />)
            expect(screen.getByTestId('spinner')).toBeInTheDocument()
        })

        it('renders text when text prop is provided', () => {
            render(<ScreenSpinner text={'Loading data...'} />)
            expect(screen.getByText('Loading data...')).toBeInTheDocument()
        })

        it('does not render text when text prop is omitted', () => {
            const { container } = render(<ScreenSpinner />)
            // The text wrapper div should not exist
            expect(container.querySelector('.text')).not.toBeInTheDocument()
        })
    })

    describe('DOM side effects', () => {
        it('appends an overlay div to document.body on mount', () => {
            const { unmount } = render(<ScreenSpinner />)
            // The overlay is appended to body (not inside the component's root)
            const overlay = document.body.querySelector('.overlay')
            expect(overlay).toBeInTheDocument()
            unmount()
        })

        it('removes the overlay div from document.body on unmount', () => {
            const { unmount } = render(<ScreenSpinner />)
            unmount()
            const overlay = document.body.querySelector('.overlay')
            expect(overlay).not.toBeInTheDocument()
        })
    })
})
