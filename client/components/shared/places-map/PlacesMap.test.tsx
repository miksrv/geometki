import React from 'react'

import { render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'

import { PlacesMap } from './PlacesMap'

const mockMap = jest.fn()

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: Array<string | undefined | false | null>) => args.filter(Boolean).join(' '),
    Container: ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <div className={className}>{children}</div>
    ),
    Skeleton: () => <div data-testid={'map-skeleton'} />
}))

jest.mock('next/dynamic', () => () => {
    const MockInteractiveMap = (props: Record<string, unknown>) => {
        mockMap(props)
        return <div data-testid={'interactive-map'} />
    }
    return MockInteractiveMap
})

const place = (id: string, lat: number, lon: number): ApiModel.PlaceMark => ({
    id,
    lat,
    lon,
    category: 'abandoned' as ApiModel.Categories
})

const lastProps = () => mockMap.mock.lastCall?.[0]

describe('PlacesMap', () => {
    beforeEach(() => mockMap.mockClear())

    it('renders nothing without places', () => {
        const { container } = render(<PlacesMap places={[]} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('shows a placeholder of the map size while the places are loading', () => {
        render(
            <PlacesMap
                places={undefined}
                loading={true}
            />
        )
        expect(screen.getByTestId('map-skeleton')).toBeInTheDocument()
        expect(screen.queryByTestId('interactive-map')).not.toBeInTheDocument()
    })

    it('renders nothing once loading finished without places', () => {
        const { container } = render(
            <PlacesMap
                places={[]}
                loading={false}
            />
        )
        expect(container).toBeEmptyDOMElement()
    })

    it('renders nothing when places are undefined', () => {
        const { container } = render(<PlacesMap />)
        expect(container).toBeEmptyDOMElement()
    })

    it('fits the viewport to the extent of all places', () => {
        render(<PlacesMap places={[place('a', 51, 55), place('b', 53, 50), place('c', 52, 60)]} />)

        expect(screen.getByTestId('interactive-map')).toBeInTheDocument()
        expect(lastProps().bounds).toStrictEqual([
            [51, 50],
            [53, 60]
        ])
        expect(lastProps().center).toBeUndefined()
        expect(lastProps().zoom).toBeUndefined()
    })

    it('lets the map zoom out below the main map limit to fit distant places', () => {
        render(<PlacesMap places={[place('a', 51, 55), place('b', 43, 131)]} />)
        expect(lastProps().minZoom).toBeLessThan(6)
    })

    it('centres a single place at a fixed zoom instead of fitting', () => {
        render(<PlacesMap places={[place('a', 51.5, 55.1)]} />)

        expect(lastProps().bounds).toBeUndefined()
        expect(lastProps().center).toStrictEqual([51.5, 55.1])
        expect(lastProps().zoom).toBe(11)
    })

    it('skips null and empty coordinates instead of putting them at (0, 0)', () => {
        render(
            <PlacesMap
                places={[
                    place('a', 51, 55),
                    place('b', 53, 57),
                    { ...place('c', 0, 0), lat: null as unknown as number },
                    { ...place('d', 0, 0), lon: '' as unknown as number }
                ]}
            />
        )

        expect(lastProps().places).toHaveLength(2)
        expect(lastProps().bounds).toStrictEqual([
            [51, 55],
            [53, 57]
        ])
    })

    it('caps the zoom when several places share one point', () => {
        render(<PlacesMap places={[place('a', 51, 55), place('b', 51, 55)]} />)
        expect(lastProps().boundsOptions.maxZoom).toBeLessThanOrEqual(16)
    })

    it('accepts decimal strings and skips places without valid coordinates', () => {
        render(
            <PlacesMap
                places={[
                    { ...place('a', 0, 0), lat: '51' as unknown as number, lon: '55' as unknown as number },
                    { ...place('b', 0, 0), lat: '53' as unknown as number, lon: '57' as unknown as number },
                    { ...place('c', 0, 0), lat: undefined as unknown as number, lon: 'x' as unknown as number }
                ]}
            />
        )

        expect(lastProps().places).toHaveLength(2)
        expect(lastProps().bounds).toStrictEqual([
            [51, 55],
            [53, 57]
        ])
    })
})
