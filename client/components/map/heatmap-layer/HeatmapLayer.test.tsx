import React from 'react'
import { useMap } from 'react-leaflet'

import { render } from '@testing-library/react'

import { API } from '@/api'

import { HeatmapLayer } from './HeatmapLayer'

jest.mock('react-leaflet', () => ({
    useMap: jest.fn().mockReturnValue({
        addLayer: jest.fn(),
        removeLayer: jest.fn()
    })
}))

jest.mock('leaflet', () => ({}))

jest.mock('leaflet.heat', () => ({}))

jest.mock('@/api', () => ({
    API: {
        usePoiGetUsersQuery: jest.fn().mockReturnValue({ data: undefined })
    }
}))

describe('HeatmapLayer', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('renders null', () => {
        const { container } = render(<HeatmapLayer />)
        expect(container.innerHTML).toBe('')
    })

    it('does not add a heatmap layer when no user data', () => {
        const mockMap = jest.mocked(useMap)()
        render(<HeatmapLayer />)
        expect(mockMap.addLayer).not.toHaveBeenCalled()
    })

    it('does not add a heatmap layer when users list is empty', () => {
        const mockMap = jest.mocked(useMap)()
        jest.mocked(API.usePoiGetUsersQuery).mockReturnValue({ data: { items: [] } })
        render(<HeatmapLayer />)
        expect(mockMap.addLayer).not.toHaveBeenCalled()
    })
})
