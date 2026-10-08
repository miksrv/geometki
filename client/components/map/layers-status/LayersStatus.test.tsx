import React from 'react'

import { act, render, screen } from '@testing-library/react'

import { MapControlsContext } from '../MapControlsContext'
import { MapAdditionalLayersEnum } from '../types'

import { LayersStatus } from './LayersStatus'
import { createLayerStatusStore, LayerStatuses, LayerStatusStore } from './store'
import { useReportLayerStatus } from './useReportLayerStatus'

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => String(opts?.defaultValue ?? key)
    })
}))

const { HISTORICAL_PHOTOS, WIKIMEDIA_COMMONS, WIKIPEDIA, HEATMAP } = MapAdditionalLayersEnum

const storeWith = (statuses: LayerStatuses): LayerStatusStore => {
    const store = createLayerStatusStore()

    Object.entries(statuses).forEach(([layer, status]) => store.set(layer as MapAdditionalLayersEnum, status))

    return store
}

const renderStatus = (layers: MapAdditionalLayersEnum[], statuses: LayerStatuses = {}) =>
    render(
        <MapControlsContext.Provider value={{ bottomSlot: null, layerStatuses: storeWith(statuses) }}>
            <LayersStatus layers={layers} />
        </MapControlsContext.Provider>
    )

describe('LayersStatus', () => {
    it('renders nothing without external layers', () => {
        const { container } = renderStatus([HEATMAP])
        expect(container).toBeEmptyDOMElement()
    })

    it('shows a row for each turned on external layer, in a fixed order', () => {
        renderStatus([WIKIPEDIA, HEATMAP, HISTORICAL_PHOTOS])
        const rows = screen.getByRole('status').children
        expect(rows).toHaveLength(2)
        expect(rows[0]).toHaveTextContent('Исторические фото')
        expect(rows[1]).toHaveTextContent('Википедия')
    })

    it('shows a spinner while loading or before the first report', () => {
        renderStatus([HISTORICAL_PHOTOS, WIKIPEDIA], { [HISTORICAL_PHOTOS]: { count: 3, loading: true } })
        expect(screen.getAllByTestId('spinner')).toHaveLength(2)
    })

    it('shows the count, an empty area, an error and a reached limit', () => {
        renderStatus([HISTORICAL_PHOTOS, WIKIMEDIA_COMMONS, WIKIPEDIA], {
            [HISTORICAL_PHOTOS]: { count: 0, loading: false },
            [WIKIMEDIA_COMMONS]: { count: 47, limited: true, loading: false },
            [WIKIPEDIA]: { count: 0, error: true, loading: false }
        })
        expect(screen.getByText('—')).toBeInTheDocument()
        expect(screen.getByText('47+')).toBeInTheDocument()
        expect(screen.getByText('Ошибка загрузки')).toBeInTheDocument()
    })

    it('shows the exact count when the source returned everything', () => {
        renderStatus([WIKIPEDIA], { [WIKIPEDIA]: { count: 12, limited: false, loading: false } })
        expect(screen.getByText('12')).toBeInTheDocument()
    })

    it('asks to zoom in when the area is too big for the source', () => {
        renderStatus([WIKIMEDIA_COMMONS], { [WIKIMEDIA_COMMONS]: { count: 0, loading: false, tooLarge: true } })
        expect(screen.getByText('Приблизьте карту')).toBeInTheDocument()
        expect(screen.queryByText('—')).not.toBeInTheDocument()
    })

    it('works without a store in the context', () => {
        render(<LayersStatus layers={[WIKIPEDIA]} />)
        expect(screen.getByTestId('spinner')).toBeInTheDocument()
    })
})

describe('useReportLayerStatus', () => {
    const Layer: React.FC<{ count: number }> = ({ count }) => {
        useReportLayerStatus(WIKIPEDIA, { count, loading: false })
        return null
    }

    const store = createLayerStatusStore()

    const Map: React.FC<{ show: boolean; count: number }> = ({ show, count }) => (
        <MapControlsContext.Provider value={{ bottomSlot: null, layerStatuses: store }}>
            {show && <Layer count={count} />}
            <LayersStatus layers={[WIKIPEDIA]} />
        </MapControlsContext.Provider>
    )

    it('reports the layer status and clears it when the layer is gone', () => {
        const { rerender } = render(
            <Map
                show={true}
                count={7}
            />
        )
        expect(screen.getByText('7')).toBeInTheDocument()

        act(() =>
            rerender(
                <Map
                    show={true}
                    count={9}
                />
            )
        )
        expect(screen.getByText('9')).toBeInTheDocument()

        act(() =>
            rerender(
                <Map
                    show={false}
                    count={9}
                />
            )
        )
        expect(screen.getByTestId('spinner')).toBeInTheDocument()
    })

    it('notifies only the subscribers of the store', () => {
        const listener = jest.fn()
        const own = createLayerStatusStore()
        const unsubscribe = own.subscribe(listener)

        own.set(WIKIPEDIA, { count: 1, loading: false })
        expect(listener).toHaveBeenCalledTimes(1)
        expect(own.get()[WIKIPEDIA]).toEqual({ count: 1, loading: false })

        unsubscribe()
        own.set(WIKIPEDIA, undefined)
        expect(listener).toHaveBeenCalledTimes(1)
    })
})
