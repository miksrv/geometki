import React, { useState } from 'react'

import { act, render, screen } from '@testing-library/react'

import { LayerStatus, MapControlsContext } from '../MapControlsContext'
import { MapAdditionalLayersEnum } from '../types'

import { LayersStatus } from './LayersStatus'
import { useReportLayerStatus } from './useReportLayerStatus'

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => String(opts?.defaultValue ?? key)
    })
}))

const { HISTORICAL_PHOTOS, WIKIMEDIA_COMMONS, WIKIPEDIA, HEATMAP } = MapAdditionalLayersEnum

describe('LayersStatus', () => {
    it('renders nothing without external layers', () => {
        const { container } = render(
            <LayersStatus
                layers={[HEATMAP]}
                statuses={{}}
            />
        )
        expect(container).toBeEmptyDOMElement()
    })

    it('shows a row for each turned on external layer, in a fixed order', () => {
        render(
            <LayersStatus
                layers={[WIKIPEDIA, HEATMAP, HISTORICAL_PHOTOS]}
                statuses={{}}
            />
        )
        const rows = screen.getByRole('status').children
        expect(rows).toHaveLength(2)
        expect(rows[0]).toHaveTextContent('Исторические фото')
        expect(rows[1]).toHaveTextContent('Википедия')
    })

    it('shows a spinner while loading or before the first report', () => {
        render(
            <LayersStatus
                layers={[HISTORICAL_PHOTOS, WIKIPEDIA]}
                statuses={{ [HISTORICAL_PHOTOS]: { count: 3, loading: true } }}
            />
        )
        expect(screen.getAllByTestId('spinner')).toHaveLength(2)
    })

    it('shows the count, an empty area, an error and a reached limit', () => {
        render(
            <LayersStatus
                layers={[HISTORICAL_PHOTOS, WIKIMEDIA_COMMONS, WIKIPEDIA]}
                statuses={{
                    [HISTORICAL_PHOTOS]: { count: 0, loading: false },
                    [WIKIMEDIA_COMMONS]: { count: 47, limited: true, loading: false },
                    [WIKIPEDIA]: { count: 0, error: true, loading: false }
                }}
            />
        )
        expect(screen.getByText('—')).toBeInTheDocument()
        expect(screen.getByText('47+')).toBeInTheDocument()
        expect(screen.getByText('Ошибка загрузки')).toBeInTheDocument()
    })

    it('shows the exact count when the source returned everything', () => {
        render(
            <LayersStatus
                layers={[WIKIPEDIA]}
                statuses={{ [WIKIPEDIA]: { count: 12, limited: false, loading: false } }}
            />
        )
        expect(screen.getByText('12')).toBeInTheDocument()
    })
})

describe('useReportLayerStatus', () => {
    const Layer: React.FC<{ count: number }> = ({ count }) => {
        useReportLayerStatus(WIKIPEDIA, { count, loading: false })
        return null
    }

    const Map: React.FC<{ show: boolean; count: number }> = ({ show, count }) => {
        const [statuses, setStatuses] = useState<Partial<Record<MapAdditionalLayersEnum, LayerStatus>>>({})
        const reportLayerStatus = React.useCallback(
            (layer: MapAdditionalLayersEnum, status?: LayerStatus) =>
                setStatuses((prev) => ({ ...prev, [layer]: status })),
            []
        )

        return (
            <MapControlsContext.Provider value={{ bottomSlot: null, reportLayerStatus }}>
                {show && <Layer count={count} />}
                <LayersStatus
                    layers={[WIKIPEDIA]}
                    statuses={statuses}
                />
            </MapControlsContext.Provider>
        )
    }

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
})
