import { Coords, DoneCallback, Point } from 'leaflet'

import { FallbackGridLayer } from './FallbackGridLayer'

const URL = 'https://tiles/{z}/{y}/{x}'

type TileFactory = { createTile: (coords: Coords, done: DoneCallback) => HTMLElement }

const createTile = (layer: FallbackGridLayer, z: number, x: number, y: number, done: DoneCallback = jest.fn()) => {
    const coords = Object.assign(new Point(x, y), { z }) as Coords
    const tile = (layer as unknown as TileFactory).createTile(coords, done)

    return { done, image: tile.querySelector('img')!, tile }
}

describe('FallbackGridLayer', () => {
    it('loads the tile of its own zoom when the service has it', () => {
        const { done, image, tile } = createTile(new FallbackGridLayer({ url: URL }), 14, 100, 200)

        expect(image.src).toBe('https://tiles/14/200/100')

        image.onload?.(new Event('load'))
        expect(image.style.width).toBe('256px')
        expect(image.style.left).toBe('0px')
        expect(done).toHaveBeenCalledWith(undefined, tile)
    })

    it('cuts a missing tile out of the parent tile, stretched', () => {
        const { done, image } = createTile(new FallbackGridLayer({ url: URL }), 14, 101, 203)

        image.onerror?.(new Event('error'))
        expect(image.src).toBe('https://tiles/13/101/50')

        image.onload?.(new Event('load'))
        expect(image.style.width).toBe('512px')
        expect(image.style.left).toBe('-256px')
        expect(image.style.top).toBe('-256px')
        expect(done).toHaveBeenCalledWith(undefined, expect.any(HTMLElement))
    })

    it('starts the neighbours right from the level with data', () => {
        const layer = new FallbackGridLayer({ url: URL })

        createTile(layer, 14, 100, 200).image.onerror?.(new Event('error'))

        expect(createTile(layer, 14, 101, 201).image.src).toBe('https://tiles/13/100/50')
    })

    it('gives up a few levels up', () => {
        const { done, image } = createTile(new FallbackGridLayer({ url: URL }), 14, 100, 200)

        for (let attempt = 0; attempt < 5; attempt++) {
            image.onerror?.(new Event('error'))
        }

        expect(image.src).toBe('https://tiles/10/12/6')
        expect(done).toHaveBeenCalledWith(expect.any(Error), expect.any(HTMLElement))
    })
})

describe('FallbackGridLayer.setUrl', () => {
    it('forgets the missing tiles of the old url', () => {
        const layer = new FallbackGridLayer({ url: URL })
        layer.redraw = jest.fn().mockReturnThis()

        createTile(layer, 14, 100, 200).image.onerror?.(new Event('error'))
        layer.setUrl('https://other/{z}/{y}/{x}')

        expect(layer.redraw).toHaveBeenCalled()
        expect(createTile(layer, 14, 101, 201).image.src).toBe('https://other/14/201/101')
    })
})
