import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { Wayback } from './Wayback'

jest.mock('react-leaflet', () => ({
    useMapEvents: () => ({ getCenter: () => ({ lat: 51.765, lng: 55.1 }), getZoom: () => 16 })
}))

jest.mock('leaflet', () => ({
    DomEvent: { disableClickPropagation: jest.fn(), disableScrollPropagation: jest.fn() }
}))

jest.mock('simple-react-ui-kit', () => ({
    Icon: ({ name }: { name: string }) => <span data-icon={name} />,
    Spinner: () => <span data-testid={'spinner'} />
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => String(opts?.defaultValue ?? key)
    })
}))

jest.mock('@/utils/date', () => ({ formatDate: (date: string) => date }))

const mockQuery = jest.fn()

jest.mock('@/api/apiWayback', () => ({
    APIWayback: { useGetLocalChangesQuery: (...args: unknown[]) => mockQuery(...args) },
    WAYBACK_TILE_URL: 'wayback/{release}/{z}/{y}/{x}'
}))

// The layer reports its url, and "loads" on a click
jest.mock('../fallback-tile-layer', () => ({
    FallbackTileLayer: ({ url, eventHandlers }: any) => (
        <button
            data-testid={'layer'}
            data-url={url}
            onClick={() => eventHandlers?.load?.()}
        />
    )
}))

const releases = [
    { date: '2026-09-24', id: 5 },
    { date: '2020-10-14', id: 3 },
    { date: '2014-02-20', id: 1 }
]

const layerUrls = () => screen.getAllByTestId('layer').map((layer) => layer.getAttribute('data-url'))

describe('Wayback', () => {
    beforeEach(() => mockQuery.mockReturnValue({ data: releases, isError: false, isFetching: false }))

    it('asks for the changes of the tile under the center', () => {
        render(<Wayback />)
        expect(mockQuery).toHaveBeenLastCalledWith({ x: 42798, y: 21716, z: 16 }, { skip: false })
    })

    it('keeps the shown imagery under the next one until the next one is loaded', () => {
        render(<Wayback />)

        expect(layerUrls()).toEqual([expect.stringContaining('World_Imagery/MapServer'), 'wayback/5/{z}/{y}/{x}'])

        fireEvent.click(screen.getAllByTestId('layer')[1])
        expect(layerUrls()).toEqual(['wayback/5/{z}/{y}/{x}'])

        fireEvent.click(screen.getByLabelText('Более старый снимок'))
        expect(layerUrls()).toEqual(['wayback/5/{z}/{y}/{x}', 'wayback/3/{z}/{y}/{x}'])
        expect(screen.getByText('2020-10-14')).toBeInTheDocument()
    })

    it('goes through the dates with the slider, oldest on the left', () => {
        render(<Wayback />)
        const slider = screen.getByLabelText('Дата снимка')

        expect(slider).toHaveValue('2')
        fireEvent.change(slider, { target: { value: '0' } })
        expect(screen.getByText('2014-02-20')).toBeInTheDocument()
        expect(screen.getByLabelText('Более старый снимок')).toBeDisabled()
    })

    it('closes', () => {
        const onClose = jest.fn()
        render(<Wayback onClose={onClose} />)

        fireEvent.click(screen.getByLabelText('Выключить снимки прошлых лет'))
        expect(onClose).toHaveBeenCalled()
    })
})
