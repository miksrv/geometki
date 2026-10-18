import { timingSafeEqual } from 'crypto'

import type { NextApiRequest, NextApiResponse } from 'next'

import i18Config from '@/next-i18next.config'

/** Paths of one request at most: a write changes a place or two */
const MAX_PATHS = 50

/** Only the cached pages: the place pages (getStaticProps) */
const ALLOWED_PATH = /^\/places\/[A-Za-z0-9-]+$/

/** The secret compared in constant time: the endpoint is public */
const isSecret = (given: unknown, secret?: string): boolean =>
    !!secret &&
    typeof given === 'string' &&
    given.length === secret.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(secret))

/**
 * POST /api/revalidate — the API asks to render pages anew after a write changed them
 * (server: App\Libraries\SitePages). Body `{ paths: ['/places/{id}-{slug}', …] }`, paths
 * without the locale prefix: each is rendered in every locale. Header `X-Revalidate-Secret`
 * must equal REVALIDATE_SECRET (a runtime variable of the Next server, e.g. in `.env.local`
 * next to server.js); without it the endpoint is off.
 *
 * Answers 202 at once and renders after: the write that asked must not wait for the pages.
 */
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
    const secret = process.env.REVALIDATE_SECRET

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST')
        return res.status(405).json({ error: 'Method not allowed' })
    }

    if (!isSecret(req.headers['x-revalidate-secret'], secret)) {
        return res.status(401).json({ error: 'Unauthorized' })
    }

    const body = req.body as { paths?: unknown } | undefined
    const paths = Array.isArray(body?.paths)
        ? body.paths.filter((path): path is string => typeof path === 'string' && ALLOWED_PATH.test(path))
        : []

    if (!paths.length || paths.length > MAX_PATHS) {
        return res.status(400).json({ error: 'Expected 1–50 place paths' })
    }

    const urls = paths.flatMap((path) =>
        i18Config.i18n.locales.map((locale) => (locale === i18Config.i18n.defaultLocale ? path : `/${locale}${path}`))
    )

    res.status(202).json({ revalidating: urls.length })

    // One by one: each render asks the API for the place, a burst would load it at once
    for (const url of urls) {
        try {
            await res.revalidate(url)
        } catch (error) {
            console.error(`[revalidate] ${url}:`, error instanceof Error ? error.message : error)
        }
    }
}

export default handler
