// Search engines, SEO and AI crawlers, scrapers and HTTP libraries: a request with no user agent counts too.
// `cubot` is a phone brand, not a bot
const CRAWLER_USER_AGENT = new RegExp(
    [
        '(?<!cu)bot\\b',
        'crawl',
        'spider',
        'slurp',
        'facebookexternalhit',
        'meta-externalagent',
        'headless',
        'python',
        'curl',
        'wget',
        'go-http-client',
        'java/',
        'okhttp',
        'scrapy',
        'httpclient',
        'axios',
        'node-fetch'
    ].join('|'),
    'i'
)

export const isCrawler = (userAgent?: string | null): boolean => !userAgent || CRAWLER_USER_AGENT.test(userAgent)

/**
 * A places list filtered by 2+ categories (`?category=a,b`): a `noindex` query, not a page,
 * and an endless set of URLs (every combination × location × sort × page) for a crawler
 */
export const isCategoryCombination = (searchParams: URLSearchParams): boolean =>
    searchParams.getAll('category').some((value) => value.includes(','))

/**
 * A places list sorted by distance from a point in the URL (`?lat=&lon=`): `noindex`, and one
 * list per place × category × page — an endless set of URLs for a crawler
 */
export const isGeoList = (searchParams: URLSearchParams): boolean => searchParams.has('lat') || searchParams.has('lon')
