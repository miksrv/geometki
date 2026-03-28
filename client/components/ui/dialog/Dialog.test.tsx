import React from 'react'

import { act, fireEvent, render, screen } from '@testing-library/react'

import { Dialog } from './Dialog'

// Mock simple-react-ui-kit Icon
jest.mock('simple-react-ui-kit', () => ({
    Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />
}))

describe('Dialog', () => {
    describe('when closed', () => {
        it('renders nothing when open is false', () => {
            const { container } = render(<Dialog open={false} />)
            expect(container.firstChild).toBeFalsy()
        })

        it('renders nothing when open is undefined', () => {
            const { container } = render(<Dialog />)
            expect(container.firstChild).toBeFalsy()
        })
    })

    describe('when open', () => {
        it('renders the dialog element', () => {
            render(<Dialog open />)
            expect(screen.getByRole('dialog')).toBeInTheDocument()
        })

        it('renders the header text', () => {
            render(
                <Dialog
                    open
                    header={'My Dialog'}
                />
            )
            expect(screen.getByText('My Dialog')).toBeInTheDocument()
        })

        it('renders children inside the content area', () => {
            render(
                <Dialog open>
                    <p>Dialog body</p>
                </Dialog>
            )
            expect(screen.getByText('Dialog body')).toBeInTheDocument()
        })

        it('renders actions when provided', () => {
            render(
                <Dialog
                    open
                    header={'Title'}
                    actions={<button>Save</button>}
                />
            )
            expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
        })

        it('renders the back link button when showBackLink is true', () => {
            render(
                <Dialog
                    open
                    showBackLink
                    backLinkCaption={'Back'}
                />
            )
            expect(screen.getByText('Back')).toBeInTheDocument()
        })
    })

    describe('keyboard interaction', () => {
        it('calls onCloseDialog when Escape key is pressed', () => {
            const onClose = jest.fn()
            render(
                <Dialog
                    open
                    onCloseDialog={onClose}
                />
            )
            act(() => {
                fireEvent.keyDown(document, { key: 'Escape' })
            })
            expect(onClose).toHaveBeenCalledTimes(1)
        })

        it('does not call onCloseDialog for other keys', () => {
            const onClose = jest.fn()
            render(
                <Dialog
                    open
                    onCloseDialog={onClose}
                />
            )
            act(() => {
                fireEvent.keyDown(document, { key: 'Enter' })
            })
            expect(onClose).not.toHaveBeenCalled()
        })
    })

    describe('click outside', () => {
        it('calls onCloseDialog when clicking outside the dialog', () => {
            const onClose = jest.fn()
            render(
                <div>
                    <Dialog
                        open
                        onCloseDialog={onClose}
                    />
                    <div data-testid={'outside'} />
                </div>
            )
            act(() => {
                fireEvent.mouseDown(screen.getByTestId('outside'))
            })
            expect(onClose).toHaveBeenCalledTimes(1)
        })
    })

    describe('back link interaction', () => {
        it('calls onBackClick when the back button is clicked', () => {
            const onBack = jest.fn()
            render(
                <Dialog
                    open
                    showBackLink
                    backLinkCaption={'Go back'}
                    onBackClick={onBack}
                />
            )
            fireEvent.click(screen.getByText('Go back'))
            expect(onBack).toHaveBeenCalledTimes(1)
        })
    })
})
