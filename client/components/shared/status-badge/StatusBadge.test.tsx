import React from 'react'

import { render, screen } from '@testing-library/react'

import { StatusBadge } from './StatusBadge'
import { MAILING_STATUS_TONES } from './tones'

jest.mock('simple-react-ui-kit', () => ({
    Badge: ({ label, className }: { label: string; className?: string }) => (
        <div
            data-testid={'badge'}
            className={className}
        >
            {label}
        </div>
    ),
    cn: (...args: Array<string | undefined | false>) => args.filter(Boolean).join(' ')
}))

describe('StatusBadge', () => {
    it('is neutral by default and takes the class of its tone', () => {
        const { rerender } = render(<StatusBadge label={'Closed'} />)

        expect(screen.getByTestId('badge')).toHaveTextContent('Closed')
        expect(screen.getByTestId('badge')).toHaveClass('statusBadge', 'neutral')

        rerender(
            <StatusBadge
                label={'Failed'}
                tone={'danger'}
            />
        )

        expect(screen.getByTestId('badge')).toHaveClass('danger')
        expect(screen.getByTestId('badge')).not.toHaveClass('neutral')
    })

    it('keeps one tone per status of every domain', () => {
        expect(MAILING_STATUS_TONES).toEqual({
            canceled: 'neutral',
            completed: 'success',
            draft: 'warning',
            sending: 'info'
        })
    })
})
