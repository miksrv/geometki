import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { CoordinatesControl } from './CoordinatesControl'

jest.mock('simple-react-ui-kit', () => ({
    Button: ({ icon, onClick, mode }: any) => (
        <button
            data-icon={icon}
            data-mode={mode}
            onClick={onClick}
        />
    ),
    Container: ({ children, onClick, className }: any) => (
        <div
            className={className}
            onClick={onClick}
        >
            {children}
        </div>
    )
}))

describe('CoordinatesControl', () => {
    describe('closed state (default)', () => {
        it('renders the PinDrop button when closed', () => {
            render(<CoordinatesControl />)
            expect(screen.getByRole('button')).toHaveAttribute('data-icon', 'PinDrop')
        })

        it('does not show coordinates when closed', () => {
            render(<CoordinatesControl coordinates={{ lat: 51.5, lon: 55.1 }} />)
            expect(screen.queryByText('Lat:')).not.toBeInTheDocument()
        })
    })

    describe('open state', () => {
        it('opens and shows coordinates when button is clicked', () => {
            render(<CoordinatesControl coordinates={{ lat: 51.765, lon: 55.099 }} />)
            fireEvent.click(screen.getByRole('button'))
            expect(screen.getByText('Lat:')).toBeInTheDocument()
            expect(screen.getByText('Lon:')).toBeInTheDocument()
        })

        it('displays the lat/lon values', () => {
            render(<CoordinatesControl coordinates={{ lat: 51.765, lon: 55.099 }} />)
            fireEvent.click(screen.getByRole('button'))
            expect(screen.getByText('51.765')).toBeInTheDocument()
            expect(screen.getByText('55.099')).toBeInTheDocument()
        })

        it('calls onChangeOpen with true when opening', () => {
            const onChangeOpen = jest.fn()
            render(<CoordinatesControl onChangeOpen={onChangeOpen} />)
            fireEvent.click(screen.getByRole('button'))
            expect(onChangeOpen).toHaveBeenCalledWith(true)
        })

        it('calls onChangeOpen with false when closing', () => {
            const onChangeOpen = jest.fn()
            render(<CoordinatesControl onChangeOpen={onChangeOpen} />)
            fireEvent.click(screen.getByRole('button'))
            // Click the container to close
            const container = screen.getByText('Lat:').closest('div')
            fireEvent.click(container!)
            expect(onChangeOpen).toHaveBeenCalledWith(false)
        })
    })
})
