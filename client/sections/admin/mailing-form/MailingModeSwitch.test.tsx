import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { defaultMailingMode, MailingModeSwitch } from './MailingModeSwitch'

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}))

describe('MailingModeSwitch', () => {
    it('presses the current mode and reports the other one', () => {
        const onChange = jest.fn()

        render(
            <MailingModeSwitch
                mode={'edit'}
                onChange={onChange}
            />
        )

        // The kit's Button is mocked in the tests: the pressed one is the primary button
        expect(screen.getByRole('button', { name: 'admin-mailing-mode-edit' })).toHaveAttribute('data-mode', 'primary')
        expect(screen.getByRole('button', { name: 'admin-mailing-mode-preview' })).toHaveAttribute(
            'data-mode',
            'secondary'
        )

        fireEvent.click(screen.getByRole('button', { name: 'admin-mailing-mode-preview' }))

        expect(onChange).toHaveBeenCalledWith('preview')
    })

    it('calls the fields of a sent mailing its content', () => {
        render(
            <MailingModeSwitch
                mode={'preview'}
                readOnly={true}
                onChange={jest.fn()}
            />
        )

        expect(screen.getByRole('button', { name: 'admin-mailing-mode-content' })).toBeInTheDocument()
    })

    it('opens a draft on its fields and a sent mailing on its letter', () => {
        expect(defaultMailingMode()).toBe('edit')
        expect(defaultMailingMode({ status: 'draft' })).toBe('edit')
        expect(defaultMailingMode({ status: 'sending' })).toBe('preview')
        expect(defaultMailingMode({ status: 'completed' })).toBe('preview')
    })
})
