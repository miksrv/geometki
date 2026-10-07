import React from 'react'

import { act, render, screen } from '@testing-library/react'

import { CoordinatesControl } from './CoordinatesControl'

type Handlers = {
    mousemove?: (event: { latlng: { lat: number; lng: number } }) => void
    mouseout?: () => void
}

let mapHandlers: Handlers = {}

jest.mock('react-leaflet', () => ({
    useMapEvents: (handlers: Handlers) => {
        mapHandlers = handlers
        return {}
    }
}))

jest.mock('simple-react-ui-kit', () => ({
    Container: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
        <div
            className={className}
            data-testid={'coordinates'}
        >
            {children}
        </div>
    )
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({ t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key })
}))

// Runs the scheduled frame right away
const flushFrame = () => act(() => jest.runOnlyPendingTimers())

describe('CoordinatesControl', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        mapHandlers = {}
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    it('is always visible, without a toggle button', () => {
        render(<CoordinatesControl coordinates={{ lat: 51.765, lon: 55.099 }} />)

        expect(screen.getByText('Lat:')).toBeInTheDocument()
        expect(screen.getByText('Lon:')).toBeInTheDocument()
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('shows the map center while there is no cursor over the map', () => {
        render(<CoordinatesControl coordinates={{ lat: 51.765, lon: 55.099 }} />)

        expect(screen.getByText('51.76500')).toBeInTheDocument()
        expect(screen.getByText('55.09900')).toBeInTheDocument()
    })

    it('follows the cursor, updating once per animation frame', () => {
        render(<CoordinatesControl coordinates={{ lat: 51.765, lon: 55.099 }} />)

        act(() => {
            mapHandlers.mousemove?.({ latlng: { lat: 10, lng: 20 } })
            mapHandlers.mousemove?.({ latlng: { lat: 10.123456, lng: -20.654321 } })
        })

        // Nothing is written before the frame
        expect(screen.getByText('51.76500')).toBeInTheDocument()

        flushFrame()

        expect(screen.getByText('10.12346')).toBeInTheDocument()
        expect(screen.getByText('-20.65432')).toBeInTheDocument()
    })

    it('goes back to the map center when the cursor leaves the map', () => {
        render(<CoordinatesControl coordinates={{ lat: 51.765, lon: 55.099 }} />)

        act(() => mapHandlers.mousemove?.({ latlng: { lat: 10, lng: 20 } }))
        flushFrame()
        act(() => mapHandlers.mouseout?.())
        flushFrame()

        expect(screen.getByText('51.76500')).toBeInTheDocument()
    })

    it('keeps the cursor position when the map center changes under it', () => {
        const { rerender } = render(<CoordinatesControl coordinates={{ lat: 51.765, lon: 55.099 }} />)

        act(() => mapHandlers.mousemove?.({ latlng: { lat: 10, lng: 20 } }))
        flushFrame()

        rerender(<CoordinatesControl coordinates={{ lat: 40, lon: 50 }} />)

        expect(screen.getByText('10.00000')).toBeInTheDocument()
    })

    it('shows a dash when nothing is known yet', () => {
        render(<CoordinatesControl />)

        expect(screen.getAllByText('—')).toHaveLength(2)
    })
})
