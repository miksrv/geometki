import type { NextApiRequest, NextApiResponse } from 'next'

import { i18nScript } from '@/utils/translations'
import { loadTranslations } from '@/utils/translations.server'

/**
 * GET /api/i18n/<locale>?v=<version> — the translations of a locale as a script, loaded by
 * every page before the app (pages/_document.tsx). Cached by the browser for a year: the
 * version in the URL changes with the file. Without the current version (an old page, a
 * language switch) the answer is cached for a few minutes only.
 */
const handler = (req: NextApiRequest, res: NextApiResponse) => {
    const { resources, versions } = loadTranslations()
    const locale = typeof req.query.locale === 'string' ? req.query.locale : ''

    if (!resources[locale]) {
        return res.status(404).send('')
    }

    res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
    res.setHeader(
        'Cache-Control',
        req.query.v === versions[locale] ? 'public, max-age=31536000, immutable' : 'public, max-age=300'
    )

    return res.status(200).send(i18nScript(locale, resources[locale]))
}

export default handler
