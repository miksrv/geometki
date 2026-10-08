import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import TabHeader from './TabHeader'

describe('TabHeader', () => {
    describe('button tab', () => {
        it('renders a button with the label', () => {
            render(<TabHeader label={'Overview'} />)
            expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument()
        })

        it('has type="button" to avoid accidental form submission', () => {
            render(<TabHeader label={'Tab'} />)
            expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
        })

        it('marks the active tab as pressed', () => {
            render(
                <TabHeader
                    label={'Active Tab'}
                    isActive
                />
            )
            const button = screen.getByRole('button')
            expect(button).toHaveClass('active')
            expect(button).toHaveAttribute('aria-pressed', 'true')
        })

        it('does not apply active class when isActive is false', () => {
            render(
                <TabHeader
                    label={'Inactive Tab'}
                    isActive={false}
                />
            )
            expect(screen.getByRole('button')).not.toHaveClass('active')
        })

        it('calls onClick handler when clicked', () => {
            const handleClick = jest.fn()
            render(
                <TabHeader
                    label={'Clickable'}
                    onClick={handleClick}
                />
            )
            fireEvent.click(screen.getByRole('button'))
            expect(handleClick).toHaveBeenCalledTimes(1)
        })
    })

    describe('link tab', () => {
        it('renders a link when href is set', () => {
            render(
                <TabHeader
                    label={'Places'}
                    href={'/users/1/places'}
                />
            )
            expect(screen.getByRole('link', { name: 'Places' })).toHaveAttribute('href', '/users/1/places')
            expect(screen.queryByRole('button')).not.toBeInTheDocument()
        })

        it('marks the active link as the current page', () => {
            render(
                <TabHeader
                    label={'Places'}
                    href={'/users/1/places'}
                    isActive
                />
            )
            const link = screen.getByRole('link')
            expect(link).toHaveClass('active')
            expect(link).toHaveAttribute('aria-current', 'page')
        })

        it('does not set aria-current on inactive links', () => {
            render(
                <TabHeader
                    label={'Places'}
                    href={'/users/1/places'}
                />
            )
            expect(screen.getByRole('link')).not.toHaveAttribute('aria-current')
        })
    })
})
