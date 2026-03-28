import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: string[]) => args.filter(Boolean).join(' '),
    Spinner: () => <div data-testid={'spinner'} />
}))

jest.mock('next/dynamic', () => (fn: () => Promise<{ default: React.ComponentType }>, options?: { loading?: () => React.ReactElement }) => {
    const MockMarkdownEditor = ({ value }: { value?: string }) => (
        <div data-testid={'markdown-editor'}>{value}</div>
    )
    MockMarkdownEditor.displayName = 'MockMarkdownEditor'
    return MockMarkdownEditor
})

import { ContentEditor } from './ContentEditor'

describe('ContentEditor', () => {
    describe('rendering', () => {
        it('renders without crashing', () => {
            const { container } = render(<ContentEditor />)
            expect(container.firstChild).toBeInTheDocument()
        })

        it('renders the markdown editor', () => {
            render(<ContentEditor />)
            expect(screen.getByTestId('markdown-editor')).toBeInTheDocument()
        })

        it('passes value to the editor', () => {
            render(<ContentEditor value={'Hello **world**'} />)
            expect(screen.getByTestId('markdown-editor')).toHaveTextContent('Hello **world**')
        })
    })

    describe('disabled prop', () => {
        it('applies disabled class when disabled is true', () => {
            const { container } = render(<ContentEditor disabled />)
            expect(container.firstChild).toHaveClass('disabled')
        })

        it('does not apply disabled class when disabled is false', () => {
            const { container } = render(<ContentEditor disabled={false} />)
            expect(container.firstChild).not.toHaveClass('disabled')
        })
    })
})
