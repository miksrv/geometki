import React from 'react'

import { render } from '@testing-library/react'

import { FitBounds } from './FitBounds'

const mockFitBounds = jest.fn()
const mockInvalidateSize = jest.fn()

jest.mock('react-leaflet', () => ({
    useMap: () => ({ fitBounds: mockFitBounds, invalidateSize: mockInvalidateSize })
}))

describe('FitBounds', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('fits the map to the bounds on mount and when they change', () => {
        const options = { padding: [10, 10] as [number, number] }
        const { rerender } = render(
            <FitBounds
                bounds={[
                    [50, 55],
                    [51, 56]
                ]}
                options={options}
            />
        )

        expect(mockInvalidateSize).toHaveBeenCalledTimes(1)
        expect(mockFitBounds).toHaveBeenCalledWith(
            [
                [50, 55],
                [51, 56]
            ],
            options
        )

        rerender(
            <FitBounds
                bounds={[
                    [50, 55],
                    [52, 57]
                ]}
                options={options}
            />
        )

        expect(mockFitBounds).toHaveBeenCalledTimes(2)
    })

    it('does nothing without bounds', () => {
        render(<FitBounds />)

        expect(mockFitBounds).not.toHaveBeenCalled()
    })
})
