import React from 'react'

import { act, fireEvent, render, screen } from '@testing-library/react'

import { FormActions } from './FormActions'

jest.mock('simple-react-ui-kit', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Button: ({ label, onClick, disabled }: any) => (
        <button
            type={'button'}
            disabled={disabled}
            onClick={onClick}
        >
            {label}
        </button>
    ),
    cn: (...args: unknown[]) => args.filter(Boolean).join(' ')
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}))

type Callback = (entries: Array<Partial<IntersectionObserverEntry>>) => void

let observe: Callback | undefined

beforeEach(() => {
    observe = undefined
    ;(global as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
        public constructor(callback: Callback) {
            observe = callback
        }
        public observe() {}
        public disconnect() {}
    }
})

const placeBelow = () =>
    act(() =>
        observe?.([
            {
                intersectionRatio: 0,
                boundingClientRect: { top: 900 } as DOMRectReadOnly,
                rootBounds: { top: 0 } as DOMRectReadOnly
            }
        ])
    )

describe('FormActions', () => {
    it('shows the buttons and the message only with changes', () => {
        const { rerender } = render(<FormActions />)

        expect(screen.getByRole('button', { name: 'save' })).toBeDisabled()
        expect(screen.queryByRole('button', { name: 'cancel' })).not.toBeInTheDocument()
        expect(screen.queryByText('form-unsaved')).not.toBeInTheDocument()

        rerender(
            <FormActions
                dirty={true}
                onCancel={jest.fn()}
            />
        )

        expect(screen.getByRole('button', { name: 'save' })).toBeEnabled()
        expect(screen.getByRole('button', { name: 'cancel' })).toBeInTheDocument()
        expect(screen.getByText('form-unsaved')).toBeInTheDocument()
    })

    it('takes its own rule for Save', () => {
        const { rerender } = render(<FormActions saveDisabled={false} />)
        expect(screen.getByRole('button', { name: 'save' })).toBeEnabled()

        rerender(
            <FormActions
                dirty={true}
                saveDisabled={true}
            />
        )
        expect(screen.getByRole('button', { name: 'save' })).toBeDisabled()
    })

    it('takes its own labels and reports the clicks', () => {
        const onSave = jest.fn()
        const onCancel = jest.fn()
        render(
            <FormActions
                dirty={true}
                message={'Место не сохранено'}
                saveLabel={'Добавить'}
                cancelLabel={'Назад'}
                onSave={onSave}
                onCancel={onCancel}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: 'Добавить' }))
        fireEvent.click(screen.getByRole('button', { name: 'Назад' }))

        expect(screen.getByText('Место не сохранено')).toBeInTheDocument()
        expect(onSave).toHaveBeenCalledTimes(1)
        expect(onCancel).toHaveBeenCalledTimes(1)
    })

    it('floats while dirty and its place is below the screen', () => {
        const { container, rerender } = render(<FormActions />)
        const row = () => container.firstElementChild?.firstElementChild

        placeBelow()
        expect(row()).not.toHaveClass('floating')

        rerender(<FormActions dirty={true} />)
        expect(row()).toHaveClass('floating')

        act(() =>
            observe?.([
                {
                    intersectionRatio: 1,
                    boundingClientRect: { top: 400 } as DOMRectReadOnly,
                    rootBounds: { top: 0 } as DOMRectReadOnly
                }
            ])
        )
        expect(row()).not.toHaveClass('floating')
    })

    it('stays in place when the place is above the screen', () => {
        const { container } = render(<FormActions dirty={true} />)

        act(() =>
            observe?.([
                {
                    intersectionRatio: 0,
                    boundingClientRect: { top: -200 } as DOMRectReadOnly,
                    rootBounds: { top: 0 } as DOMRectReadOnly
                }
            ])
        )

        expect(container.firstElementChild?.firstElementChild).not.toHaveClass('floating')
    })
})
