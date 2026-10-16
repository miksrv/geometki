import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { Chip } from './Chip'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
    Icon: ({ name }: { name: string }) => <i data-testid={`icon-${name}`} />
}))

jest.mock('next/link', () => {
    const Link = ({ href, children, ...props }: any) => (
        <a
            href={href}
            {...props}
        >
            {children}
        </a>
    )
    Link.displayName = 'Link'
    return Link
})

describe('Chip', () => {
    it('is a toggle button reporting its state', () => {
        const onClick = jest.fn()
        render(
            <Chip
                label={'Пещеры'}
                selected={true}
                onClick={onClick}
            />
        )

        const chip = screen.getByRole('button', { name: 'Пещеры' })
        expect(chip).toHaveAttribute('aria-pressed', 'true')

        fireEvent.click(chip)
        expect(onClick).toHaveBeenCalled()
    })

    it('is a link with href, marked current when selected', () => {
        render(
            <Chip
                label={'Пещеры'}
                href={'/places?category=cave'}
                selected={true}
            />
        )

        expect(screen.getByRole('link', { name: 'Пещеры' })).toHaveAttribute('href', '/places?category=cave')
        expect(screen.getByRole('link')).toHaveAttribute('aria-current', 'true')
    })

    it('shows a cross when removable and takes an explicit name', () => {
        render(
            <Chip
                label={'Пещеры'}
                removable={true}
                aria-label={'Убрать фильтр: Пещеры'}
            />
        )

        expect(screen.getByTestId('icon-Close')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Убрать фильтр: Пещеры' })).not.toHaveAttribute('aria-pressed')
    })

    it('renders the icon before the label', () => {
        render(
            <Chip
                label={'Пещеры'}
                icon={<img alt={''} />}
            />
        )

        expect(screen.getByRole('button').querySelector('img')).toBeInTheDocument()
    })
})
