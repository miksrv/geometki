import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: string[]) => args.filter(Boolean).join(' ')
}))

import { RatingColored } from './RatingColored'

describe('RatingColored', () => {
    describe('rendering', () => {
        it('renders children when a value is provided', () => {
            render(<RatingColored value={3.5}><span>3.5</span></RatingColored>)
            expect(screen.getByText('3.5')).toBeInTheDocument()
        })

        it('renders nothing when value is 0 (falsy)', () => {
            const { container } = render(<RatingColored value={0} />)
            // RatingColored renders empty fragment for falsy value
            expect(container.textContent).toBe('')
        })

        it('renders nothing when value is undefined', () => {
            const { container } = render(<RatingColored />)
            expect(container.textContent).toBe('')
        })
    })

    describe('background color', () => {
        it('applies a background-color style when value is positive', () => {
            const { container } = render(<RatingColored value={3}><span>score</span></RatingColored>)
            const div = container.firstChild as HTMLElement
            expect(div.style.backgroundColor).not.toBe('')
        })

        it('applies a reddish color for value <= 2', () => {
            const { container } = render(<RatingColored value={1}><span>low</span></RatingColored>)
            const div = container.firstChild as HTMLElement
            // The color should be rgb with high red component
            expect(div.style.backgroundColor).toMatch(/rgb\(/)
        })

        it('applies a greenish color for value near 5', () => {
            const { container } = render(<RatingColored value={5}><span>high</span></RatingColored>)
            const div = container.firstChild as HTMLElement
            expect(div.style.backgroundColor).toMatch(/rgb\(/)
        })
    })

    describe('className prop', () => {
        it('applies custom className', () => {
            const { container } = render(<RatingColored value={3} className={'my-class'} />)
            expect(container.firstChild).toHaveClass('my-class')
        })
    })
})
