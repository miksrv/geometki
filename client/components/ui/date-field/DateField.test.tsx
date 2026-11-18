import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { DateField } from './DateField'

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({ i18n: { language: 'en' }, t: (key: string) => key })
}))

const mockPicker = jest.fn()

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
    DatePicker: (props: any) => {
        mockPicker(props)

        return (
            <button
                disabled={props.disabled}
                onClick={() => props.onDateSelect('2027-01-15')}
            >
                {props.datePeriod[0] ?? props.placeholder}
            </button>
        )
    }
}))

describe('DateField', () => {
    beforeEach(() => mockPicker.mockClear())

    it('names the group by its label and hands the chosen day on', () => {
        const onChange = jest.fn()

        render(
            <DateField
                label={'Start'}
                value={'2027-01-01'}
                minDate={'2026-12-01'}
                onChange={onChange}
            />
        )

        expect(screen.getByRole('group', { name: 'Start' })).toBeInTheDocument()
        expect(mockPicker).toHaveBeenLastCalledWith(
            expect.objectContaining({ datePeriod: ['2027-01-01', '2027-01-01'], locale: 'en', minDate: '2026-12-01' })
        )

        fireEvent.click(screen.getByRole('button'))

        expect(onChange).toHaveBeenCalledWith('2027-01-15')
    })

    it('shows the placeholder without a day, and the error under the mockPicker', () => {
        render(
            <DateField
                label={'End'}
                error={'Required'}
                onChange={jest.fn()}
            />
        )

        expect(screen.getByRole('button', { name: 'date-field-placeholder' })).toBeInTheDocument()
        expect(screen.getByRole('alert')).toHaveTextContent('Required')
    })
})
