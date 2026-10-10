export const IMG_HOST = 'https://img.pastvu.com'
export const MIN_YEAR = 1826
export const MAX_YEAR = new Date().getFullYear()
export const THUMBNAIL_ZOOM = 17

/** From this zoom PastVu stops clustering: the request needs `localWork` and the layer groups the photos itself */
export const LOCAL_WORK_ZOOM = 17

/** Grid cell for grouping the photos on the screen, px: about a thumbnail with a margin */
export const GROUP_CELL_SIZE = 64

export const DIR_TO_DEGREES: Record<string, number> = {
    e: 90,
    n: 0,
    ne: 45,
    nw: 315,
    s: 180,
    se: 135,
    sw: 225,
    w: 270
}
