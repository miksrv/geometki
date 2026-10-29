/**
 * A grid of pointy-top hexagons in a flat pixel space (the Web Mercator pixels of a map zoom),
 * for binning points on the map. Axial coordinates `(q, r)`, the usual cube rounding; no
 * library, the whole thing is a few formulas.
 *
 * `size` is the circumradius in pixels: a hexagon is `sqrt(3) * size` wide and `2 * size` tall.
 */

export interface HexCoords {
    q: number
    r: number
}

export interface HexBin<T> {
    key: string
    q: number
    r: number
    /** The centre of the cell in the same pixel space as the points */
    x: number
    y: number
    items: T[]
}

const SQRT3 = Math.sqrt(3)

export const hexKey = ({ q, r }: HexCoords): string => `${q},${r}`

/** The cell a pixel falls into */
export const pixelToHex = (x: number, y: number, size: number): HexCoords => {
    const q = ((SQRT3 / 3) * x - (1 / 3) * y) / size
    const r = ((2 / 3) * y) / size

    return roundHex(q, r)
}

/** The centre of a cell in pixels */
export const hexToPixel = ({ q, r }: HexCoords, size: number): { x: number; y: number } => ({
    x: size * (SQRT3 * q + (SQRT3 / 2) * r),
    y: size * ((3 / 2) * r)
})

/** The six corners of a cell, clockwise from the top */
export const hexCorners = (x: number, y: number, size: number): Array<[number, number]> =>
    [0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (Math.PI / 180) * (60 * i - 90)

        return [x + size * Math.cos(angle), y + size * Math.sin(angle)]
    })

/**
 * Points binned into hexagons. `toPixel` projects an item into the pixel space; items it
 * returns `undefined` for are left out. The bins come in no particular order.
 */
export const binByHex = <T>(
    items: T[],
    toPixel: (item: T) => [number, number] | undefined,
    size: number
): Array<HexBin<T>> => {
    const bins = new Map<string, HexBin<T>>()

    for (const item of items) {
        const pixel = toPixel(item)

        if (!pixel) {
            continue
        }

        const hex = pixelToHex(pixel[0], pixel[1], size)
        const key = hexKey(hex)
        let bin = bins.get(key)

        if (!bin) {
            const centre = hexToPixel(hex, size)

            bin = { items: [], key, q: hex.q, r: hex.r, x: centre.x, y: centre.y }
            bins.set(key, bin)
        }

        bin.items.push(item)
    }

    return [...bins.values()]
}

/** Fractional axial coordinates to the nearest cell (cube rounding: the largest error is fixed) */
const roundHex = (q: number, r: number): HexCoords => {
    const s = -q - r
    let rq = Math.round(q)
    let rr = Math.round(r)
    const rs = Math.round(s)

    const dq = Math.abs(rq - q)
    const dr = Math.abs(rr - r)
    const ds = Math.abs(rs - s)

    if (dq > dr && dq > ds) {
        rq = -rr - rs
    } else if (dr > ds) {
        rr = -rq - rs
    }

    return { q: rq, r: rr }
}
