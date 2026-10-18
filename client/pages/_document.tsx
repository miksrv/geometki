import Document, { Head, Html, Main, NextScript } from 'next/document'

import i18Config from '../next-i18next.config'
import { i18nScriptUrl } from '../utils/translations'

class MyDocument extends Document {
    public render() {
        const locale = this.props.locale ?? i18Config.i18n.defaultLocale
        // Set by the page's data function on this server (utils/translations.server.ts)
        const versions = globalThis.__GEOMETKI_I18N_VERSIONS__ ?? {}
        const urls = Object.fromEntries(
            i18Config.i18n.locales.map((code) => [code, i18nScriptUrl(code, versions[code])])
        )

        return (
            <Html lang={locale}>
                <Head />
                <body>
                    <Main />
                    {/* The texts of the page's locale, before the app (it renders with them): a
                        script cached for a year instead of ~20 KB of every page's data. After the
                        content, so it does not hold the first paint; not deferred, so it surely
                        runs before the app's deferred scripts. The URLs of the other locales are
                        for a language switch (utils/translations.ts) */}
                    <script
                        dangerouslySetInnerHTML={{ __html: `self.__GEOMETKI_I18N_URLS__=${JSON.stringify(urls)}` }}
                    />
                    {/* eslint-disable-next-line next/no-sync-scripts */}
                    <script src={urls[locale]} />
                    <NextScript />
                </body>
            </Html>
        )
    }
}

export default MyDocument
