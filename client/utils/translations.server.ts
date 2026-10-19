import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import { join } from 'path'

import i18Config from '../next-i18next.config'

import type { I18nResources, I18nVersions } from './translations'

/**
 * The translations of the site on the server: read once from `public/locales/<locale>/common.json`
 * and kept in `globalThis`, where `_app` (appWithTranslation's resources) and `_document` (the
 * script URL) find them. The pages do not carry them in their props any more: the browser loads
 * its locale once, as a script cached for a year (`/api/i18n/<locale>?v=<version>`).
 *
 * Server only: import it from getStaticProps / getServerSideProps / API routes, never from a
 * component (it reads files).
 */
export const loadTranslations = (): { resources: I18nResources; versions: I18nVersions } => {
    // A changed text shows up on reload in development, without restarting the server
    if (!globalThis.__GEOMETKI_I18N__ || process.env.NODE_ENV === 'development') {
        const resources: I18nResources = {}
        const versions: I18nVersions = {}

        for (const locale of i18Config.i18n.locales) {
            const text = readFileSync(join(process.cwd(), 'public', 'locales', locale, 'common.json'), 'utf8')

            resources[locale] = { common: JSON.parse(text) as Record<string, unknown> }
            versions[locale] = createHash('md5').update(text).digest('hex').slice(0, 10)
        }

        globalThis.__GEOMETKI_I18N__ = resources
        globalThis.__GEOMETKI_I18N_VERSIONS__ = versions
    }

    return { resources: globalThis.__GEOMETKI_I18N__!, versions: globalThis.__GEOMETKI_I18N_VERSIONS__! }
}

/**
 * Call at the start of every getStaticProps / getServerSideProps: makes sure the server render
 * has the translations. Returns nothing for the props — they stay out of the page data.
 */
export const loadPageTranslations = async (): Promise<Record<string, never>> => {
    loadTranslations()

    return {}
}
