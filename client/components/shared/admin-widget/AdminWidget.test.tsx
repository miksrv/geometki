import React from 'react'

import { render, screen } from '@testing-library/react'

import { AdminWidget } from './AdminWidget'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: Array<string | undefined | false>) => args.filter(Boolean).join(' '),
    Icon: () => null,
    Skeleton: () => <div data-testid={'skeleton'} />
}))

const facts = [
    { href: '/admin/sending-mail?status=error', key: 'errors', label: 'Errors', tone: 'danger' as const, value: 3 },
    { key: 'sent', label: 'Sent', value: 120 }
]

describe('AdminWidget', () => {
    it('has the head with the title link, the facts and the footer', () => {
        render(
            <AdminWidget
                icon={'Feed'}
                title={'Mail'}
                href={'/admin/sending-mail'}
                facts={facts}
                footer={<button type={'button'}>Create</button>}
            />
        )

        expect(screen.getByRole('region', { name: 'Mail' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Mail' })).toHaveAttribute('href', '/admin/sending-mail')
        // A fact with a link leads into the filtered list; one without is plain text
        expect(screen.getByRole('link', { name: '3' })).toHaveAttribute('href', '/admin/sending-mail?status=error')
        expect(screen.getByText('120').closest('a')).toBeNull()
        expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
    })

    it('shows skeletons while loading and a quiet line on an error, never the facts', () => {
        const { rerender } = render(
            <AdminWidget
                icon={'Feed'}
                title={'Mail'}
                href={'/admin/sending-mail'}
                facts={facts}
                loading={true}
            />
        )

        expect(screen.getAllByTestId('skeleton')).toHaveLength(3)
        expect(screen.queryByText('Errors')).not.toBeInTheDocument()

        rerender(
            <AdminWidget
                icon={'Feed'}
                title={'Mail'}
                href={'/admin/sending-mail'}
                facts={facts}
                error={'Failed to load'}
            />
        )

        expect(screen.getByText('Failed to load')).toBeInTheDocument()
        expect(screen.queryByText('Errors')).not.toBeInTheDocument()
    })
})
