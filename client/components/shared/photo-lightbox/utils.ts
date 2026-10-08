import { SlideImage } from 'yet-another-react-lightbox'

import { getImageProps } from 'next/image'

import { IMG_HOST } from '@/config/env'

export const isAbsoluteUrl = (link?: string): boolean => !!link && /^https?:\/\//.test(link)

/** Our photos come as paths on the image host, external ones (Wikimedia, PastVu) as absolute URLs */
export const resolveImageUrl = (link?: string): string | undefined =>
    !link ? undefined : isAbsoluteUrl(link) ? link : `${IMG_HOST}${link}`

/**
 * Responsive sources of a photo from our image host, made by the Next.js image optimizer:
 * the lightbox picks the one that fits the screen and loads bigger ones while zooming in.
 * The optimizer never enlarges a photo, so the widths above the original are dropped and the
 * first of them is kept as the original size.
 */
export const buildSrcSet = (src: string, width: number, height: number): SlideImage['srcSet'] => {
    let srcSet: string | undefined

    try {
        srcSet = getImageProps({ alt: '', height, quality: 75, sizes: '100vw', src, width }).props.srcSet
    } catch {
        // The host is not allowed for the optimizer (a local stand with another image host): the photo as is
        return undefined
    }

    const sources = (srcSet ?? '')
        .split(', ')
        .map((item) => {
            const [url, descriptor] = item.split(' ')
            return { url, width: parseInt(descriptor, 10) }
        })
        .filter(({ url, width }) => url && width > 0)

    const smaller = sources.filter((source) => source.width < width)
    const original = sources.find((source) => source.width >= width)

    return [...smaller, ...(original ? [{ ...original, width }] : [])].map((source) => ({
        height: Math.round((source.width / width) * height),
        src: source.url,
        width: source.width
    }))
}

/** The box a photo takes on the slide: fits the slide, never bigger than the photo itself */
export const fitToRect = (
    rect: { width: number; height: number },
    width: number,
    height: number
): { width: number; height: number } => {
    const scale = Math.min(rect.width / width, rect.height / height, 1)

    return { height: Math.round(height * scale), width: Math.round(width * scale) }
}
