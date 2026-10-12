import { Coords, DoneCallback, GridLayer, GridLayerOptions, TileEvent, Util } from 'leaflet'

export interface FallbackGridLayerOptions extends GridLayerOptions {
    url: string
}

// How many zoom levels up a missing tile may be taken from: 4 levels is a 16x stretch, coarser is useless
const MAX_FALLBACK_LEVELS = 4

/** One request for a tile url, shared by every tile that waits for it */
type Probe = {
    image: HTMLImageElement
    result: Promise<boolean>
    waiters: number
}

type FallbackTile = HTMLElement & { abortLoading?: () => void }

/**
 * Tiles for services whose data goes to different zooms in different places: the ESRI hillshade (zoom 16
 * near Moscow, 13 near Orenburg), old Wayback imagery. Where the service answers 404, the tile is cut out
 * of the nearest level up that has it, stretched.
 *
 * Each url is asked once: the tiles that need the same parent wait for one request, and a url that
 * answered 404 is not asked again. Tiles that leave the screen stop loading, like in Leaflet's TileLayer.
 */
export class FallbackGridLayer extends GridLayer {
    private url: string
    // Urls that answered 404 (or failed): the tiles go a level up at once
    private readonly missing = new Set<string>()
    private readonly probes = new Map<string, Probe>()

    public constructor({ url, ...options }: FallbackGridLayerOptions) {
        super(options)
        this.url = url
        this.on('tileunload', ({ tile }: TileEvent) => (tile as FallbackTile).abortLoading?.())
    }

    /** Shows other tiles, e.g. another imagery release */
    public setUrl(url: string) {
        if (url !== this.url) {
            this.url = url
            this.missing.clear()
            this.redraw()
        }

        return this
    }

    protected createTile(coords: Coords, done: DoneCallback): HTMLElement {
        const tile: FallbackTile = document.createElement('div')
        const image = document.createElement('img')
        const size = this.getTileSize().x

        let cancelled = false
        let release: (() => void) | undefined

        tile.style.overflow = 'hidden'
        image.alt = ''
        image.setAttribute('role', 'presentation')
        image.style.position = 'absolute'
        image.style.maxWidth = 'none'
        tile.appendChild(image)

        const fail = () => done(new Error(`No tile for ${coords.z}/${coords.x}/${coords.y}`), tile)

        const load = (levelsUp: number) => {
            const scale = 2 ** levelsUp
            const z = coords.z - levelsUp
            const x = Math.floor(coords.x / scale)
            const y = Math.floor(coords.y / scale)
            const url = this.tileUrl(z, x, y)
            const canGoUp = levelsUp < MAX_FALLBACK_LEVELS && z > 0

            if (this.missing.has(url)) {
                if (canGoUp) {
                    load(levelsUp + 1)
                } else {
                    fail()
                }

                return
            }

            const probe = this.probe(url)

            release = probe.release

            void probe.result.then((found) => {
                release = undefined

                if (cancelled) {
                    return
                }

                if (!found) {
                    if (canGoUp) {
                        load(levelsUp + 1)
                    } else {
                        fail()
                    }

                    return
                }

                image.style.width = image.style.height = `${size * scale}px`
                image.style.left = `${-(coords.x - x * scale) * size}px`
                image.style.top = `${-(coords.y - y * scale) * size}px`
                image.onload = () => done(undefined, tile)
                image.onerror = fail
                // Already loaded by the probe: comes from the browser's cache
                image.src = url
            })
        }

        tile.abortLoading = () => {
            cancelled = true
            release?.()
            image.onload = image.onerror = null
            image.src = Util.emptyImageUrl
        }

        load(0)

        return tile
    }

    /** The answer for a url: one request however many tiles ask, cancelled when none of them waits any more */
    private probe(url: string): { result: Promise<boolean>; release: () => void } {
        let probe = this.probes.get(url)

        if (!probe) {
            const image = new Image()
            const result = new Promise<boolean>((resolve) => {
                image.onload = () => resolve(true)
                image.onerror = () => resolve(false)
            }).then((found) => {
                this.probes.delete(url)

                if (!found) {
                    this.missing.add(url)
                }

                return found
            })

            image.src = url
            probe = { image, result, waiters: 0 }
            this.probes.set(url, probe)
        }

        const current = probe
        let released = false

        current.waiters++

        return {
            release: () => {
                if (released) {
                    return
                }

                released = true
                current.waiters--

                if (!current.waiters && this.probes.get(url) === current) {
                    this.probes.delete(url)
                    current.image.onload = current.image.onerror = null
                    current.image.src = Util.emptyImageUrl
                }
            },
            result: current.result
        }
    }

    private tileUrl(z: number, x: number, y: number) {
        return this.url.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y))
    }
}
