import { computeMapView } from './utils'

describe('computeMapView', () => {
    it('returns the default view without points', () => {
        expect(computeMapView([])).toStrictEqual({ center: [55.751244, 37.618423], zoom: 5 })
    })

    it('centres on a single point at street level without bounds', () => {
        const view = computeMapView([{ lat: 51.77, lon: 55.1 }])

        expect(view.center).toStrictEqual([51.77, 55.1])
        expect(view.zoom).toBe(13)
        expect(view.bounds).toBeUndefined()
    })

    it('returns the bounding box of several points', () => {
        const view = computeMapView([
            { lat: 51.77, lon: 55.1 },
            { lat: 52.3, lon: 54.0 },
            { lat: 51.2, lon: 56.5 }
        ])

        expect(view.bounds).toStrictEqual([
            [51.2, 54.0],
            [52.3, 56.5]
        ])
        expect(view.center).toStrictEqual([51.75, 55.25])
    })
})
