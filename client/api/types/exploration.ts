/** `[lat, lon, category]`, the coordinates rounded to 3 decimals; no category is `null` */
export type Point = [number, number, string | null]

/** `GET /exploration/points`: every published place and every open candidate, for the hex layer */
export interface PointsResponse {
    places: Point[]
    spots: Point[]
}
