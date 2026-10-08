import { buildSrcSet, fitToRect, isAbsoluteUrl, resolveImageUrl } from './utils'

jest.mock('@/config/env', () => ({
    IMG_HOST: 'https://img.example.com/'
}))

describe('resolveImageUrl', () => {
    it('adds the image host to a path', () => {
        expect(resolveImageUrl('photos/1.jpg')).toBe('https://img.example.com/photos/1.jpg')
    })

    it('keeps an absolute URL', () => {
        expect(resolveImageUrl('https://upload.wikimedia.org/a.jpg')).toBe('https://upload.wikimedia.org/a.jpg')
        expect(isAbsoluteUrl('http://x.org/a.jpg')).toBe(true)
    })

    it('returns undefined without a link', () => {
        expect(resolveImageUrl(undefined)).toBeUndefined()
    })
})

describe('buildSrcSet', () => {
    it('makes optimizer sources up to the photo width, keeping its proportions', () => {
        const srcSet = buildSrcSet('https://img.example.com/photos/1.jpg', 1000, 500)!

        expect(srcSet.map(({ width }) => width)).toStrictEqual([640, 750, 828, 1000])
        expect(srcSet[0]).toStrictEqual({
            height: 320,
            src: '/_next/image?url=https%3A%2F%2Fimg.example.com%2Fphotos%2F1.jpg&w=640&q=75',
            width: 640
        })
        // The source for the original size is the next optimizer width, which is never enlarged
        expect(srcSet[3]).toEqual(expect.objectContaining({ height: 500, src: expect.stringContaining('&w=1080&') }))
    })

    it('stops at the biggest optimizer width for a huge photo', () => {
        const srcSet = buildSrcSet('https://img.example.com/photos/1.jpg', 4048, 3036)!
        expect(srcSet[srcSet.length - 1].width).toBe(3840)
    })
})

describe('fitToRect', () => {
    it('fits a big photo into the slide', () => {
        expect(fitToRect({ height: 800, width: 1000 }, 4000, 2000)).toStrictEqual({ height: 500, width: 1000 })
        expect(fitToRect({ height: 800, width: 1000 }, 1000, 2000)).toStrictEqual({ height: 800, width: 400 })
    })

    it('does not enlarge a small photo', () => {
        expect(fitToRect({ height: 800, width: 1000 }, 300, 200)).toStrictEqual({ height: 200, width: 300 })
    })
})
