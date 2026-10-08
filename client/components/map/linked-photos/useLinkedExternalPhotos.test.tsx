import React from 'react'
import * as ReactLeaflet from 'react-leaflet'
import type { LatLngBounds } from 'leaflet'

import { act, render } from '@testing-library/react'

import { API } from '@/api'

import { boundsParam, useLinkedExternalPhotos } from './useLinkedExternalPhotos'

jest.mock('react-leaflet', () => ({
    useMapEvents: jest.fn()
}))

jest.mock('@/api', () => ({
    API: { useExternalPhotosGetListQuery: jest.fn().mockReturnValue({ data: undefined }) }
}))

const bounds = (south: number, west: number, north: number, east: number): LatLngBounds =>
    ({
        getEast: () => east,
        getNorth: () => north,
        getSouth: () => south,
        getWest: () => west
    }) as LatLngBounds

describe('boundsParam', () => {
    it('rounds the area outwards to 0.01°, so that small pans share one request', () => {
        expect(boundsParam(bounds(51.123, 54.956, 51.181, 55.041))).toBe('51.12,54.95,51.19,55.05')
        expect(boundsParam(bounds(51.128, 54.951, 51.189, 55.049))).toBe('51.12,54.95,51.19,55.05')
    })

    it('asks nothing for an area over a square degree', () => {
        expect(boundsParam(bounds(51, 54, 52.5, 55))).toBeUndefined()
    })

    it('asks nothing across the antimeridian', () => {
        expect(boundsParam(bounds(60, 179.5, 61, -179.5))).toBeUndefined()
    })
})

describe('useLinkedExternalPhotos', () => {
    const Layer: React.FC = () => {
        useLinkedExternalPhotos('pastvu')
        return null
    }

    beforeEach(() => {
        jest.useFakeTimers()
        jest.mocked(API.useExternalPhotosGetListQuery).mockClear()
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    it('asks for the visible area at once, and after a move only when the map has stopped', () => {
        let handlers: { moveend: () => void } = { moveend: () => undefined }
        let current = bounds(51.12, 54.95, 51.18, 55.05)

        jest.mocked(ReactLeaflet.useMapEvents).mockImplementation((events) => {
            handlers = events as typeof handlers
            return { getBounds: () => current } as unknown as ReturnType<typeof ReactLeaflet.useMapEvents>
        })

        render(<Layer />)

        expect(API.useExternalPhotosGetListQuery).toHaveBeenLastCalledWith(
            { bounds: '51.12,54.95,51.18,55.05' },
            { skip: false }
        )

        current = bounds(51.22, 55.05, 51.28, 55.15)
        act(() => handlers.moveend())

        expect(API.useExternalPhotosGetListQuery).toHaveBeenLastCalledWith(
            { bounds: '51.12,54.95,51.18,55.05' },
            { skip: false }
        )

        act(() => {
            jest.advanceTimersByTime(500)
        })

        expect(API.useExternalPhotosGetListQuery).toHaveBeenLastCalledWith(
            { bounds: '51.22,55.05,51.28,55.15' },
            { skip: false }
        )
    })
})
