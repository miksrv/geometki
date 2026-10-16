import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { BottomSheet } from './BottomSheet'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: Array<string | false | undefined>) => args.filter(Boolean).join(' ')
}))

describe('BottomSheet', () => {
    it('renders nothing while closed', () => {
        render(
            <BottomSheet
                open={false}
                onClose={jest.fn()}
            >
                <button type={'button'}>Row</button>
            </BottomSheet>
        )

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('renders a modal dialog named by its title', () => {
        render(
            <BottomSheet
                open={true}
                title={'Маршрут'}
                onClose={jest.fn()}
            >
                <button type={'button'}>Row</button>
            </BottomSheet>
        )

        expect(screen.getByRole('dialog', { name: 'Маршрут' })).toHaveAttribute('aria-modal', 'true')
    })

    it('moves focus to the first control', () => {
        render(
            <BottomSheet
                open={true}
                onClose={jest.fn()}
            >
                <button type={'button'}>First</button>
                <button type={'button'}>Second</button>
            </BottomSheet>
        )

        expect(screen.getByText('First')).toHaveFocus()
    })

    it('closes on Escape', () => {
        const onClose = jest.fn()

        render(
            <BottomSheet
                open={true}
                onClose={onClose}
            >
                <button type={'button'}>Row</button>
            </BottomSheet>
        )

        fireEvent.keyDown(document, { key: 'Escape' })

        expect(onClose).toHaveBeenCalled()
    })

    it('closes when a row is chosen', () => {
        const onClose = jest.fn()
        const onRow = jest.fn()

        render(
            <BottomSheet
                open={true}
                onClose={onClose}
            >
                <button
                    type={'button'}
                    onClick={onRow}
                >
                    Row
                </button>
            </BottomSheet>
        )

        fireEvent.click(screen.getByText('Row'))

        expect(onRow).toHaveBeenCalled()
        expect(onClose).toHaveBeenCalled()
    })

    it('locks the page scroll while open', () => {
        const { rerender } = render(
            <BottomSheet
                open={true}
                onClose={jest.fn()}
            />
        )

        expect(document.body.style.overflow).toBe('hidden')

        rerender(
            <BottomSheet
                open={false}
                onClose={jest.fn()}
            />
        )

        expect(document.body.style.overflow).toBe('')
    })
})
