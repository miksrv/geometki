/** Translations by locale and namespace: `{ ru: { common: {...} } }` */
export type I18nResources = Record<string, Record<string, Record<string, unknown>>>

/** A short hash of each locale's file: the version in its script URL */
export type I18nVersions = Record<string, string>

declare global {
    // Set on the server by translations.server.ts, in the browser by the locale script
    // (/api/i18n/<locale>) loaded before the app
    var __GEOMETKI_I18N__: I18nResources | undefined
    var __GEOMETKI_I18N_VERSIONS__: I18nVersions | undefined
    // The browser's URLs of every locale's script, for a language switch (_document)
    var __GEOMETKI_I18N_URLS__: Record<string, string> | undefined
}

/** The URL of a locale's script: the version makes it cacheable for a year */
export const i18nScriptUrl = (locale: string, version?: string): string =>
    `/api/i18n/${locale}${version ? `?v=${version}` : ''}`

/** The script of a locale: adds it to the translations in the browser */
export const i18nScript = (locale: string, resources: Record<string, Record<string, unknown>>): string =>
    `(self.__GEOMETKI_I18N__=self.__GEOMETKI_I18N__||{})[${JSON.stringify(locale)}]=${JSON.stringify(resources)};`

/**
 * Loads another locale's translations in the browser before switching to it: a page carries
 * only its own locale. Resolves at once when they are here already.
 */
export const ensureLocaleResources = (locale: string): Promise<void> => {
    if (typeof window === 'undefined' || window.__GEOMETKI_I18N__?.[locale]) {
        return Promise.resolve()
    }

    return new Promise((resolve) => {
        const script = document.createElement('script')

        script.src = window.__GEOMETKI_I18N_URLS__?.[locale] ?? i18nScriptUrl(locale)
        // A failed load still switches: the texts then show their Russian defaults
        script.onload = () => resolve()
        script.onerror = () => resolve()

        document.head.appendChild(script)
    })
}
