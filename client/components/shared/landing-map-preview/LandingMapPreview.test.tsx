import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { act, render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'

import { LandingMapPreview } from './LandingMapPreview'

const mockPlacesMap = jest.fn()
jest.mock('@/components/shared/places-map', () => ({
    PlacesMap: (props: any) => {
        mockPlacesMap(props)
        return <div data-testid={'places-map'} />
    }
}))

// Captures the callback passed to `new IntersectionObserver(...)` so tests can simulate the
// block scrolling into view without a real layout engine.
let observeCallback: IntersectionObserverCallback | undefined
const observe = jest.fn()
const disconnect = jest.fn()

class MockIntersectionObserver {
    public constructor(callback: IntersectionObserverCallback) {
        observeCallback = callback
    }
    public observe = observe
    public disconnect = disconnect
    public unobserve = jest.fn()
    public takeRecords = jest.fn()
    public root = null
    public rootMargin = ''
    public thresholds = []
}

const place = (id: string, lat: number, lon: number, category = 'cave'): ApiModel.PlaceListItem =>
    ({ category, id, lat, lon }) as unknown as ApiModel.PlaceListItem

beforeEach(() => {
    observeCallback = undefined
    observe.mockClear()
    disconnect.mockClear()
    mockPlacesMap.mockClear()
    // @ts-expect-error -- test double for a DOM API jsdom does not implement
    global.IntersectionObserver = MockIntersectionObserver
})

describe('LandingMapPreview', () => {
    it('reserves the map box with the loading skeleton before the block has intersected', () => {
        render(<LandingMapPreview places={[place('a', 51.7, 55.1)]} />)

        expect(screen.getByTestId('landing-map-preview')).toBeInTheDocument()
        expect(observe).toHaveBeenCalled()
        // The placeholder has the final size, so the map's arrival shifts nothing (CLS)
        expect(mockPlacesMap).toHaveBeenCalledWith(expect.objectContaining({ compact: true, loading: true }))
        expect(mockPlacesMap).not.toHaveBeenCalledWith(expect.objectContaining({ places: expect.anything() }))
    })

    it('renders PlacesMap, compact, once the block intersects', () => {
        render(<LandingMapPreview places={[place('a', 51.7, 55.1)]} />)

        act(() => {
            observeCallback?.(
                [{ isIntersecting: true } as IntersectionObserverEntry],
                new MockIntersectionObserver(() => {})
            )
        })

        expect(screen.getByTestId('places-map')).toBeInTheDocument()
        expect(mockPlacesMap).toHaveBeenCalledWith(
            expect.objectContaining({ compact: true, places: [expect.objectContaining({ id: 'a' })] })
        )
    })

    it('passes fullMapQuery through to PlacesMap once visible', () => {
        render(
            <LandingMapPreview
                places={[place('a', 51.7, 55.1)]}
                fullMapQuery={'?category=cave'}
            />
        )

        act(() => {
            observeCallback?.(
                [{ isIntersecting: true } as IntersectionObserverEntry],
                new MockIntersectionObserver(() => {})
            )
        })

        expect(mockPlacesMap).toHaveBeenCalledWith(expect.objectContaining({ fullMapQuery: '?category=cave' }))
    })

    it('stays empty once visible when there are no placed places', () => {
        render(<LandingMapPreview places={[]} />)

        act(() => {
            observeCallback?.(
                [{ isIntersecting: true } as IntersectionObserverEntry],
                new MockIntersectionObserver(() => {})
            )
        })

        expect(screen.queryByTestId('places-map')).not.toBeInTheDocument()
    })

    it('filters out places without coordinates or a category before handing them to PlacesMap', () => {
        render(
            <LandingMapPreview places={[place('a', 51.7, 55.1), { id: 'b' } as unknown as ApiModel.PlaceListItem]} />
        )

        act(() => {
            observeCallback?.(
                [{ isIntersecting: true } as IntersectionObserverEntry],
                new MockIntersectionObserver(() => {})
            )
        })

        expect(mockPlacesMap).toHaveBeenCalledWith(
            expect.objectContaining({ places: [expect.objectContaining({ id: 'a' })] })
        )
    })

    it('does not crash when rendered without a browser (no IntersectionObserver global) — SSR', () => {
        // @ts-expect-error -- simulate the server environment: no IntersectionObserver at all
        delete global.IntersectionObserver

        expect(() => renderToStaticMarkup(<LandingMapPreview places={[place('a', 51.7, 55.1)]} />)).not.toThrow()
    })
})
