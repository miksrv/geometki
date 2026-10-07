import React from 'react'

import { render, screen } from '@testing-library/react'

import { ContentEditor } from './ContentEditor'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: string[]) => args.filter(Boolean).join(' '),
    Spinner: () => <div data-testid={'spinner'} />
}))

jest.mock(
    'next/dynamic',
    () => (_fn: () => Promise<{ default: React.ComponentType }>, _options?: { loading?: () => React.ReactElement }) => {
        const MockMarkdownEditor = ({ value }: { value?: string }) => <div data-testid={'markdown-editor'}>{value}</div>
        MockMarkdownEditor.displayName = 'MockMarkdownEditor'
        return MockMarkdownEditor
    }
)

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

    describe('sizing', () => {
        it('sets the default minimum height and no maximum as custom properties', () => {
            const { container } = render(<ContentEditor />)
            const wrapper = container.firstChild as HTMLElement

            expect(wrapper.style.getPropertyValue('--editor-min-height')).toBe('120px')
            expect(wrapper.style.getPropertyValue('--editor-max-height')).toBe('none')
        })

        it('passes custom heights and the class name to the wrapper', () => {
            const { container } = render(
                <ContentEditor
                    minHeight={80}
                    maxHeight={400}
                    className={'custom'}
                />
            )
            const wrapper = container.firstChild as HTMLElement

            expect(wrapper.style.getPropertyValue('--editor-min-height')).toBe('80px')
            expect(wrapper.style.getPropertyValue('--editor-max-height')).toBe('400px')
            expect(wrapper).toHaveClass('custom')
        })
    })

    describe('disabled prop', () => {
        it('applies disabled class and aria-disabled when disabled is true', () => {
            const { container } = render(<ContentEditor disabled />)
            expect(container.firstChild).toHaveClass('disabled')
            expect(container.firstChild).toHaveAttribute('aria-disabled', 'true')
        })

        it('does not apply disabled class when disabled is false', () => {
            const { container } = render(<ContentEditor disabled={false} />)
            expect(container.firstChild).not.toHaveClass('disabled')
        })
    })
})
