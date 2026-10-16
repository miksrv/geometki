import React from 'react'

import { render, screen } from '@testing-library/react'

import { FieldTrigger } from './FieldTrigger'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
    Icon: ({ name }: { name: string }) => <i data-testid={`icon-${name}`} />
}))

describe('FieldTrigger', () => {
    it('shows the icon, the name, the value and a chevron', () => {
        render(
            <FieldTrigger
                icon={'Point'}
                label={'Где'}
                value={'Везде'}
            />
        )

        expect(screen.getByTestId('icon-Point')).toBeInTheDocument()
        expect(screen.getByText('Где')).toBeInTheDocument()
        expect(screen.getByText('Везде')).toBeInTheDocument()
        expect(screen.getByTestId('icon-KeyboardDown')).toBeInTheDocument()
    })

    it('is not a control itself: the Popout around it is', () => {
        render(<FieldTrigger value={'Везде'} />)

        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
})
