import { Coords, DoneCallback, Point, Util } from 'leaflet'

import { FallbackGridLayer } from './FallbackGridLayer'

const URL = 'https://tiles/{z}/{y}/{x}'

type TileFactory = { createTile: (coords: Coords, done: DoneCallback) => HTMLElement }

// The layer asks each url with `new Image()`: the requests are kept here to be answered by the test
let requests: HTMLImageElement[] = []
const OriginalImage = window.Image

beforeEach(() => {
    requests = []
    window.Image = jest.fn(() => {
        const image = document.createElement('img')
        requests.push(image)
        return image
    }) as unknown as typeof Image
})

afterEach(() => {
    window.Image = OriginalImage
})

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

const requestsOf = (url: string) => requests.filter((image) => image.src === url)

/** The service answers the request of the url: the tile or 404 */
const answer = async (url: string, found: boolean) => {
    const [request] = requestsOf(url)

    expect(request).toBeDefined()

    if (found) {
        request.onload?.(new Event('load'))
    } else {
        request.onerror?.(new Event('error'))
    }

    await flush()
}

const createTile = (layer: FallbackGridLayer, z: number, x: number, y: number, done: DoneCallback = jest.fn()) => {
    const coords = Object.assign(new Point(x, y), { z }) as Coords
    const tile = (layer as unknown as TileFactory).createTile(coords, done)

    return { done, image: tile.querySelector('img')!, tile }
}

describe('FallbackGridLayer', () => {
    it('loads the tile of its own zoom when the service has it', async () => {
        const { done, image, tile } = createTile(new FallbackGridLayer({ url: URL }), 14, 100, 200)

        await answer('https://tiles/14/200/100', true)
        expect(image.src).toBe('https://tiles/14/200/100')
        expect(image.style.width).toBe('256px')
        expect(image.style.left).toBe('0px')

        image.onload?.(new Event('load'))
        expect(done).toHaveBeenCalledWith(undefined, tile)
    })

    it('cuts a missing tile out of the parent tile, stretched', async () => {
        const { done, image } = createTile(new FallbackGridLayer({ url: URL }), 14, 101, 203)

        await answer('https://tiles/14/203/101', false)
        await answer('https://tiles/13/101/50', true)

        expect(image.src).toBe('https://tiles/13/101/50')
        expect(image.style.width).toBe('512px')
        expect(image.style.left).toBe('-256px')
        expect(image.style.top).toBe('-256px')

        image.onload?.(new Event('load'))
        expect(done).toHaveBeenCalledWith(undefined, expect.any(HTMLElement))
    })

    it('asks the parent once for all the tiles that need it', async () => {
        const layer = new FallbackGridLayer({ url: URL })
        const first = createTile(layer, 14, 100, 200)
        const second = createTile(layer, 14, 101, 201)

        await answer('https://tiles/14/200/100', false)
        await answer('https://tiles/14/201/101', false)

        expect(requestsOf('https://tiles/13/100/50')).toHaveLength(1)

        await answer('https://tiles/13/100/50', true)
        expect(first.image.src).toBe('https://tiles/13/100/50')
        expect(second.image.src).toBe('https://tiles/13/100/50')
    })

    it('does not ask a url that answered 404 again', async () => {
        const layer = new FallbackGridLayer({ url: URL })

        createTile(layer, 14, 100, 200)
        await answer('https://tiles/14/200/100', false)

        createTile(layer, 14, 100, 200)
        expect(requestsOf('https://tiles/14/200/100')).toHaveLength(1)
    })

    it('keeps a neighbour that has data at its own zoom', async () => {
        const layer = new FallbackGridLayer({ url: URL })

        createTile(layer, 14, 100, 200)
        await answer('https://tiles/14/200/100', false)

        const neighbour = createTile(layer, 14, 101, 201)
        await answer('https://tiles/14/201/101', true)

        expect(neighbour.image.src).toBe('https://tiles/14/201/101')
    })

    it('gives up a few levels up', async () => {
        const { done } = createTile(new FallbackGridLayer({ url: URL }), 14, 100, 200)

        for (const url of [
            'https://tiles/14/200/100',
            'https://tiles/13/100/50',
            'https://tiles/12/50/25',
            'https://tiles/11/25/12',
            'https://tiles/10/12/6'
        ]) {
            await answer(url, false)
        }

        expect(done).toHaveBeenCalledWith(expect.any(Error), expect.any(HTMLElement))
    })

    it('stops loading a tile that left the screen', async () => {
        const layer = new FallbackGridLayer({ url: URL })
        const { done, tile } = createTile(layer, 14, 100, 200)
        const [request] = requestsOf('https://tiles/14/200/100')

        layer.fire('tileunload', { tile })

        expect(request.src).toBe(Util.emptyImageUrl)
        expect(request.onload).toBeNull()
        await flush()
        expect(done).not.toHaveBeenCalled()
    })

    it('goes on loading a url while another tile still waits for it', async () => {
        const layer = new FallbackGridLayer({ url: URL })

        createTile(layer, 14, 100, 200)
        createTile(layer, 14, 101, 201)
        await answer('https://tiles/14/200/100', false)
        await answer('https://tiles/14/201/101', false)

        const gone = createTile(layer, 14, 100, 201)
        await answer('https://tiles/14/201/100', false)

        const [parent] = requestsOf('https://tiles/13/100/50')
        layer.fire('tileunload', { tile: gone.tile })

        expect(parent.src).toBe('https://tiles/13/100/50')
    })
})

describe('FallbackGridLayer.setUrl', () => {
    it('forgets the missing tiles of the old url', async () => {
        const layer = new FallbackGridLayer({ url: URL })
        layer.redraw = jest.fn().mockReturnThis()

        createTile(layer, 14, 100, 200)
        await answer('https://tiles/14/200/100', false)
        layer.setUrl('https://other/{z}/{y}/{x}')

        expect(layer.redraw).toHaveBeenCalled()

        createTile(layer, 14, 100, 200)
        expect(requestsOf('https://other/14/200/100')).toHaveLength(1)
    })
})
