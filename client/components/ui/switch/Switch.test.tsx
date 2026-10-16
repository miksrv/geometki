import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { Switch } from './Switch'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' ')
}))

describe('Switch', () => {
    it('is a switch with its state', () => {
        render(
            <Switch
                label={'Скрыть посещённые'}
                checked={true}
            />
        )

        expect(screen.getByRole('switch', { name: 'Скрыть посещённые' })).toHaveAttribute('aria-checked', 'true')
    })

    it('reports the opposite state on click', () => {
        const onChange = jest.fn()
        render(
            <Switch
                label={'Скрыть посещённые'}
                onChange={onChange}
            />
        )

        fireEvent.click(screen.getByRole('switch'))
        expect(onChange).toHaveBeenCalledWith(true)
    })

    it('shows the description in the row variant only', () => {
        const { rerender } = render(
            <Switch
                label={'Скрыть посещённые'}
                description={'Где вы были'}
            />
        )

        expect(screen.queryByText('Где вы были')).not.toBeInTheDocument()

        rerender(
            <Switch
                variant={'row'}
                label={'Скрыть посещённые'}
                description={'Где вы были'}
            />
        )

        expect(screen.getByText('Где вы были')).toBeInTheDocument()
    })
})
