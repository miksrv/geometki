import { Coords, DoneCallback, GridLayer, GridLayerOptions } from 'leaflet'

export interface HillshadeGridLayerOptions extends GridLayerOptions {
    url: string
}

// How many zoom levels up a missing tile may be taken from: 4 levels is a 16x stretch, coarser is useless
const MAX_FALLBACK_LEVELS = 4

/**
 * The tile service has its data to different zooms in different regions (zoom 16 near Moscow, 13 near
 * Orenburg). With `blankTile=false` it answers 404 where it has no data, and such a tile is cut out of
 * the nearest level that has it, stretched. The tiles that answered 404 are remembered by their parent,
 * so the neighbours start right from the level with data instead of failing the same way first.
 */
export class HillshadeGridLayer extends GridLayer {
    private readonly url: string
    // "z/x/y" of tiles whose children are known to have no data
    private readonly noChildren = new Set<string>()

    public constructor({ url, ...options }: HillshadeGridLayerOptions) {
        super(options)
        this.url = url
    }

    protected createTile(coords: Coords, done: DoneCallback): HTMLElement {
        const tile = document.createElement('div')
        const image = document.createElement('img')
        const size = this.getTileSize().x

        tile.style.overflow = 'hidden'
        image.alt = ''
        image.setAttribute('role', 'presentation')
        image.style.position = 'absolute'
        image.style.maxWidth = 'none'
        tile.appendChild(image)

        const load = (levelsUp: number) => {
            const scale = 2 ** levelsUp
            const z = coords.z - levelsUp
            const x = Math.floor(coords.x / scale)
            const y = Math.floor(coords.y / scale)

            if (levelsUp < MAX_FALLBACK_LEVELS && z > 0 && this.noChildren.has(this.key(z - 1, x >> 1, y >> 1))) {
                load(levelsUp + 1)
                return
            }

            image.onload = () => {
                image.style.width = image.style.height = `${size * scale}px`
                image.style.left = `${-(coords.x - x * scale) * size}px`
                image.style.top = `${-(coords.y - y * scale) * size}px`
                done(undefined, tile)
            }

            image.onerror = () => {
                if (z > 0) {
                    this.noChildren.add(this.key(z - 1, x >> 1, y >> 1))
                }

                if (levelsUp < MAX_FALLBACK_LEVELS && z > 0) {
                    load(levelsUp + 1)
                } else {
                    done(new Error(`No hillshade tile for ${this.key(coords.z, coords.x, coords.y)}`), tile)
                }
            }

            image.src = this.url.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y))
        }

        load(0)

        return tile
    }

    private key(z: number, x: number, y: number) {
        return `${z}/${x}/${y}`
    }
}
