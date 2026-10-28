import React, { useCallback, useMemo, useRef, useState } from 'react'
import { Pane, Polygon, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { LatLng, Tooltip as LeafletTooltip } from 'leaflet'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel, ApiType } from '@/api'
import { useAppSelector } from '@/app/store'
import { binByHex, hexCorners } from '@/utils/hexGrid'

import { HEX_EDGE_COLOR, HEX_MAX_ZOOM, HEX_PLACE_COLOR, HEX_SPOT_COLOR, HEX_VISITED_COLOR } from './constants'

import styles from './styles.module.sass'

export { HEX_MAX_ZOOM }

/** Circumradius of a cell in pixels: a cell is ~55px wide, like a cluster bubble with air around it. No counts inside: the colour tells how much of a cell is explored, the tooltip has the numbers */
const HEX_SIZE = 32

/** Points this far (px) outside the view are binned too, so the cells at the edge are whole */
const HEX_PADDING = HEX_SIZE * 2

/** One opacity for every colour. The cells multiply the tiles (`.pane`), so the colour stays whole and the roads and the labels still show through */
const HEX_FILL = 0.8

/** The shares are rounded to this many steps: the colours are told apart, and a few points more do not repaint every cell */
const HEX_STEPS = 4

/** Visited places tint a cell at least this much: one visit among 50 places is still seen */
const HEX_MIN_VISITED = 0.25

interface HexLayerProps {
    /** Undefined or empty: all the categories */
    categories?: ApiModel.Categories[]
}

interface View {
    zoom: number
    minX: number
    minY: number
    maxX: number
    maxY: number
}

interface Cell {
    key: string
    x: number
    y: number
    places: number
    spots: number
    /** The visitor's own visited places in the cell (signed-in only) */
    visited: number
}

/** What a polygon is drawn with: the same objects while the view is the same, so react-leaflet does not reset it */
interface CellGeometry {
    corners: LatLng[]
    handlers: { click: () => void }
}

type PlacedCell = Cell & CellGeometry

/** A point in the pixel space of zoom 0: the pixels of any zoom are these times 2^zoom (Leaflet's CRS scales linearly) */
type Projected = [x: number, y: number, category: string | null]

/** Projected once per answer, not once per move: 14 000 projections are the dear part of a bin pass */
const projectAll = (map: ReturnType<typeof useMap>, points: ApiType.Exploration.Point[]): Projected[] =>
    points.map((point) => {
        const { x, y } = map.project([point[0], point[1]], 0)

        return [x, y, point[2]]
    })

const sameView = (a: View, b: View): boolean =>
    a.zoom === b.zoom && a.minX === b.minX && a.minY === b.minY && a.maxX === b.maxX && a.maxY === b.maxY

const readView = (map: ReturnType<typeof useMap>): View => {
    const bounds = map.getPixelBounds()

    return {
        maxX: bounds.max?.x ?? 0,
        maxY: bounds.max?.y ?? 0,
        minX: bounds.min?.x ?? 0,
        minY: bounds.min?.y ?? 0,
        zoom: map.getZoom()
    }
}

const toStep = (share: number): number => Math.round(share * HEX_STEPS) / HEX_STEPS

type Lab = [l: number, a: number, b: number]

const toLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const fromLinear = (c: number): number => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

/** A colour in OKLab: mixed there, two hues meet in a clean middle, not in the grey of an RGB mix */
const toLab = (color: string): Lab => {
    const [r, g, b] = [1, 3, 5].map((at) => toLinear(parseInt(color.slice(at, at + 2), 16) / 255))
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

    return [
        0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
    ]
}

const fromLab = ([L, A, B]: Lab): string => {
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
    const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
    const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3

    return `#${[
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
    ]
        .map((c) =>
            Math.round(Math.min(1, Math.max(0, fromLinear(c))) * 255)
                .toString(16)
                .padStart(2, '0')
        )
        .join('')}`
}

/**
 * The colour of a cell: its three states mixed by their shares, in HEX_STEPS steps, in OKLab.
 * Pale to deep green tells how much is on the map, the blue's strength how much of it the
 * visitor has seen (at least HEX_MIN_VISITED with one visit)
 */
export const hexFill = (places: number, spots: number, visited: number): string => {
    const total = places + spots
    const own = Math.min(visited, places)
    const blue = own ? toStep(Math.max(HEX_MIN_VISITED, own / total)) : 0
    // The rest of the cell between the green of the places not visited and the pale green of the spots
    const rest = total - own
    const green = rest ? (1 - blue) * toStep((places - own) / rest) : 0
    const pale = 1 - blue - green

    const parts: Array<[string, number]> = [
        [HEX_VISITED_COLOR, blue],
        [HEX_PLACE_COLOR, green],
        [HEX_SPOT_COLOR, pale]
    ]
    // One state: its own colour as it is, no round trip through OKLab
    const whole = parts.find(([, share]) => share === 1)

    if (whole) {
        return whole[0]
    }

    const labs = parts.map(([color, share]) => toLab(color).map((v) => v * share))

    return fromLab([0, 1, 2].map((i) => labs.reduce((sum, lab) => sum + lab[i], 0)) as Lab)
}

export const HexLayer: React.FC<HexLayerProps> = ({ categories }) => {
    const { t } = useTranslation()
    const map = useMap()

    const [view, setView] = useState<View>(() => readView(map))

    // A zoom fires `zoomend` and then `moveend`: the second one finds the same view, nothing to bin again
    const updateView = useCallback(() => {
        const next = readView(map)

        setView((prev) => (sameView(prev, next) ? prev : next))
    }, [map])

    // A drag gives the cells no `mouseout`: the hint of the cell under the cursor stays open while the
    // cells around it come and go, and a few drags leave a trail of them. A move closes them all
    const closeHints = useCallback(() => {
        map.eachLayer((layer) => {
            if (layer instanceof LeafletTooltip) {
                map.closeTooltip(layer)
            }
        })
    }, [map])

    useMapEvents({ movestart: closeHints, moveend: updateView, zoomstart: closeHints, zoomend: updateView })

    const active = view.zoom < HEX_MAX_ZOOM

    const { data } = API.useExplorationGetPointsQuery(undefined, { skip: !active })

    // The places the visitor has been to, one small request for a signed-in visitor: they tint their cells blue
    const userId = useAppSelector((state) => state.auth.user?.id)
    const { data: visitedData } = API.usePoiGetListQuery({ visited: userId! }, { skip: !active || !userId })
    const visited = useMemo<ApiType.Exploration.Point[]>(
        // Rounded like the server rounds the places, so a visited place falls into the cell of its point
        () =>
            (visitedData?.items ?? []).map((item) => [
                Math.round(item.lat * 1000) / 1000,
                Math.round(item.lon * 1000) / 1000,
                item.category ?? null
            ]),
        [visitedData]
    )

    const projected = useMemo(
        () => (data ? { places: projectAll(map, data.places), spots: projectAll(map, data.spots) } : undefined),
        [data, map]
    )
    const projectedVisited = useMemo(() => projectAll(map, visited), [visited, map])

    // Geometry of the cells of one zoom: the grid is anchored in the pixel space of the zoom, so a
    // pan or a category toggle changes which cells there are, not their shapes; the cells that
    // stay keep their objects and react-leaflet leaves their polygons alone
    const geometry = useRef<{ zoom?: number; items: Map<string, CellGeometry> }>({ items: new Map() })

    const cells = useMemo<PlacedCell[]>(() => {
        if (!active || !projected) {
            return []
        }

        const { zoom } = view
        const scale = 2 ** zoom
        const shown = categories?.length ? new Set<string>(categories) : undefined
        const minX = view.minX - HEX_PADDING
        const maxX = view.maxX + HEX_PADDING
        const minY = view.minY - HEX_PADDING
        const maxY = view.maxY + HEX_PADDING

        const toPixel = (point: Projected): [number, number] | undefined => {
            if (shown && (point[2] == null || !shown.has(point[2]))) {
                return undefined
            }

            const x = point[0] * scale
            const y = point[1] * scale

            return x < minX || x > maxX || y < minY || y > maxY ? undefined : [x, y]
        }

        const bins = new Map<string, Cell>()
        const add = (points: Projected[], kind: 'places' | 'spots' | 'visited') => {
            for (const bin of binByHex(points, toPixel, HEX_SIZE)) {
                const cell = bins.get(bin.key) ?? {
                    key: bin.key,
                    places: 0,
                    spots: 0,
                    visited: 0,
                    x: bin.x,
                    y: bin.y
                }

                cell[kind] += bin.items.length
                bins.set(bin.key, cell)
            }
        }

        add(projected.places, 'places')
        add(projected.spots, 'spots')
        add(projectedVisited, 'visited')

        if (geometry.current.zoom !== zoom) {
            geometry.current = { items: new Map(), zoom }
        }

        const { items } = geometry.current

        return [...bins.values()].map((cell) => {
            let shape = items.get(cell.key)

            if (!shape) {
                const centre = map.unproject([cell.x, cell.y], zoom)

                shape = {
                    corners: hexCorners(cell.x, cell.y, HEX_SIZE).map((corner) => map.unproject(corner, zoom)),
                    handlers: { click: () => map.setView([centre.lat, centre.lng], map.getZoom() + 2) }
                }
                items.set(cell.key, shape)
            }

            return { ...cell, ...shape }
        })
    }, [active, projected, projectedVisited, categories, view, map])

    // One options object per fill, so a polygon does not restyle on every render. The edge: blue
    // where the visitor has been, dashed green while nothing in the cell is on the map
    const pathOptions = useMemo(() => {
        const cache = new Map<string, object>()

        return (places: number, spots: number, visited: number) => {
            const fill = hexFill(places, spots, visited)
            const edge = visited > 0 ? HEX_VISITED_COLOR : HEX_EDGE_COLOR
            const dashed = places === 0
            const key = `${fill}|${edge}|${String(dashed)}`

            if (!cache.has(key)) {
                cache.set(key, {
                    color: edge,
                    dashArray: dashed ? '3 3' : undefined,
                    fillColor: fill,
                    fillOpacity: HEX_FILL,
                    opacity: 0.8,
                    weight: 1
                })
            }

            return cache.get(key)!
        }
    }, [])

    if (!active) {
        return null
    }

    // Their own pane: it multiplies the tiles under it (a path cannot, the pane isolates it)
    return (
        <Pane
            name={'hexes'}
            className={styles.pane}
        >
            {cells.map((cell) => {
                // A line per count, the zeros left out: the visitor's own, the places, the not added ones
                const rows = [
                    cell.visited > 0 && t('hex_visited', { count: cell.visited, defaultValue: 'Вы были: {{count}}' }),
                    cell.places > 0 && t('hex_places', { count: cell.places, defaultValue: 'На карте: {{count}}' }),
                    cell.spots > 0 && t('hex_spots', { count: cell.spots, defaultValue: 'Не добавлено: {{count}}' })
                ].filter((row): row is string => !!row)

                return (
                    <Polygon
                        key={cell.key}
                        positions={cell.corners}
                        pathOptions={pathOptions(cell.places, cell.spots, cell.visited)}
                        eventHandlers={cell.handlers}
                    >
                        {/* Follows the cursor, above it like the markers' hints (the default direction is sideways).
                            Its own pane: react-leaflet would put it into the cells' pane, under the markers and multiplied */}
                        <Tooltip
                            pane={'tooltipPane'}
                            sticky={true}
                            direction={'top'}
                            offset={[0, -10]}
                        >
                            <span className={styles.hint}>
                                {rows.map((row) => (
                                    <span key={row}>{row}</span>
                                ))}
                            </span>
                        </Tooltip>
                    </Polygon>
                )
            })}
        </Pane>
    )
}
