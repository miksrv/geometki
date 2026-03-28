import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { ReadMore } from './ReadMore'

// Mock react-markdown to render plain text
jest.mock('react-markdown', () => {
    const ReactMarkdown = ({ children }: any) => <div data-testid={'markdown'}>{children}</div>
    ReactMarkdown.displayName = 'ReactMarkdown'
    return ReactMarkdown
})

const SHORT_TEXT = 'Hello world'
const LONG_TEXT =
    'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur'

describe('ReadMore', () => {
    describe('short text (no toggle needed)', () => {
        it('renders the text directly without a toggle button', () => {
            render(<ReadMore charCount={500}>{SHORT_TEXT}</ReadMore>)
            expect(screen.getByText(/Hello world/)).toBeInTheDocument()
            expect(screen.queryByRole('button')).not.toBeInTheDocument()
        })
    })

    describe('long text (toggle needed)', () => {
        it('renders the "Show more" button by default', () => {
            render(<ReadMore charCount={50}>{LONG_TEXT}</ReadMore>)
            expect(screen.getByRole('button', { name: 'Show more' })).toBeInTheDocument()
        })

        it('expands to full content when "Show more" is clicked', () => {
            render(<ReadMore charCount={50}>{LONG_TEXT}</ReadMore>)
            fireEvent.click(screen.getByRole('button', { name: 'Show more' }))
            // After expanding, react-markdown is rendered
            expect(screen.getByTestId('markdown')).toBeInTheDocument()
        })

        it('shows "Show less" button after expanding', () => {
            render(<ReadMore charCount={50}>{LONG_TEXT}</ReadMore>)
            fireEvent.click(screen.getByRole('button', { name: 'Show more' }))
            expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument()
        })

        it('collapses back when "Show less" is clicked', () => {
            render(<ReadMore charCount={50}>{LONG_TEXT}</ReadMore>)
            fireEvent.click(screen.getByRole('button', { name: 'Show more' }))
            fireEvent.click(screen.getByRole('button', { name: 'Show less' }))
            expect(screen.getByRole('button', { name: 'Show more' })).toBeInTheDocument()
        })

        it('appends ellipsis after the truncated text', () => {
            const { container } = render(<ReadMore charCount={50}>{LONG_TEXT}</ReadMore>)
            expect(container.textContent).toContain('...')
        })
    })

    describe('custom button labels', () => {
        it('uses custom showMoreText and showLessText', () => {
            render(
                <ReadMore
                    charCount={50}
                    showMoreText={'Read more'}
                    showLessText={'Collapse'}
                >
                    {LONG_TEXT}
                </ReadMore>
            )
            expect(screen.getByRole('button', { name: 'Read more' })).toBeInTheDocument()
            fireEvent.click(screen.getByRole('button', { name: 'Read more' }))
            expect(screen.getByRole('button', { name: 'Collapse' })).toBeInTheDocument()
        })
    })

    describe('empty/undefined children', () => {
        it('renders without crashing when children is undefined', () => {
            const { container } = render(<ReadMore />)
            expect(container).toBeInTheDocument()
        })
    })

    describe('className prop', () => {
        it('applies a custom className to the root element', () => {
            const { container } = render(<ReadMore className={'my-class'}>{SHORT_TEXT}</ReadMore>)
            expect(container.firstChild).toHaveClass('my-class')
        })
    })
})
