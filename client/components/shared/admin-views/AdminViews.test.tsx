import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { AdminViews } from './AdminViews'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: Array<string | undefined | false>) => args.filter(Boolean).join(' '),
    Icon: () => null
}))

const views = [
    { count: 10, key: undefined, label: 'All' },
    { count: 2, key: 'error' as const, label: 'Errors' }
]

describe('AdminViews', () => {
    it('presses the active view and reports a change', () => {
        const onChange = jest.fn()

        render(
            <AdminViews
                aria-label={'Status'}
                views={views}
                active={'error'}
                onChange={onChange}
            />
        )

        expect(screen.getByRole('group', { name: 'Status' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Errors/ })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: /All/ })).toHaveAttribute('aria-pressed', 'false')

        fireEvent.click(screen.getByRole('button', { name: /All/ }))
        expect(onChange).toHaveBeenCalledWith(undefined)
    })

    it('presses "everything" without an active view, and nothing when another filter holds the field', () => {
        const { rerender } = render(
            <AdminViews
                aria-label={'Status'}
                views={views}
                onChange={jest.fn()}
            />
        )

        expect(screen.getByRole('button', { name: /All/ })).toHaveAttribute('aria-pressed', 'true')

        rerender(
            <AdminViews
                aria-label={'Status'}
                views={views}
                none={true}
                onChange={jest.fn()}
            />
        )

        expect(screen.getByRole('button', { name: /All/ })).toHaveAttribute('aria-pressed', 'false')
    })
})
