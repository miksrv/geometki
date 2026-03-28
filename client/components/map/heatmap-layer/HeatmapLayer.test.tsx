import React from 'react'
import { render } from '@testing-library/react'

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

import { HeatmapLayer } from './HeatmapLayer'

describe('HeatmapLayer', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('renders null', () => {
        const { container } = render(<HeatmapLayer />)
        expect(container.innerHTML).toBe('')
    })

    it('does not add a heatmap layer when no user data', () => {
        const { useMap } = require('react-leaflet')
        const mockMap = useMap()
        render(<HeatmapLayer />)
        expect(mockMap.addLayer).not.toHaveBeenCalled()
    })

    it('does not add a heatmap layer when users list is empty', () => {
        const { API } = require('@/api')
        const { useMap } = require('react-leaflet')
        const mockMap = useMap()
        API.usePoiGetUsersQuery.mockReturnValue({ data: { items: [] } })
        render(<HeatmapLayer />)
        expect(mockMap.addLayer).not.toHaveBeenCalled()
    })
})
