import React, { useEffect } from 'react'
import { Provider } from 'react-redux'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import utc from 'dayjs/plugin/utc'

import { AppProps } from 'next/app'
import { useRouter } from 'next/dist/client/router'
import Head from 'next/head'
import Script from 'next/script'
// import { useReportWebVitals } from 'next/web-vitals'
import { appWithTranslation, useTranslation } from 'next-i18next/pages'
import { generateDefaultSeo } from 'next-seo/pages'
import { ThemeProvider } from 'next-themes'

import { wrapper } from '@/app/store'
import { ThemeColor } from '@/components/layout/theme-color/ThemeColor'
import { LOCAL_STORAGE } from '@/config/constants'
import { API_HOST } from '@/config/env'
import packageInfo from '@/package.json'
import * as LocalStorage from '@/utils/localstorage'
import { registerServiceWorker } from '@/utils/serviceWorker'
import { rememberTimeZone } from '@/utils/timeZone'
import { ensureLocaleResources } from '@/utils/translations'

import i18Config from '../next-i18next.config'

import 'dayjs/locale/ru'

// Kit tokens and component styles first, project overrides after
import 'simple-react-ui-kit/theme.css'
import 'simple-react-ui-kit/styles.css'
import '@/styles/theme.css'
import '@/styles/globals.sass'

dayjs.extend(utc)
dayjs.extend(relativeTime)

const App = ({ Component, pageProps }: AppProps) => {
    const router = useRouter()
    const { i18n } = useTranslation()
    const { store } = wrapper.useWrappedStore(pageProps)

    // Set synchronously on every render so SSR and initial client render use the correct locale
    dayjs.locale(i18n.language ?? i18Config.i18n.defaultLocale)

    useEffect(() => {
        const savedLocale = LocalStorage.getItem(LOCAL_STORAGE.LOCALE as 'LOCALE')

        if (
            savedLocale &&
            i18n.language !== savedLocale &&
            i18Config.i18n.locales.includes(savedLocale) &&
            !['/404', '/500'].includes(router.pathname)
        ) {
            // The page brought only its own locale's texts
            void ensureLocaleResources(savedLocale).then(() =>
                router.replace(router.asPath, router.asPath, { locale: savedLocale })
            )
        }
    }, [])

    useEffect(() => {
        registerServiceWorker(packageInfo.version, API_HOST)
        rememberTimeZone()
    }, [])

    // useReportWebVitals((metric) => {
    //     console.log(metric)
    // })

    return (
        <ThemeProvider defaultTheme={'light'}>
            <Head>
                {generateDefaultSeo({ titleTemplate: `%s | ${i18n.language === 'ru' ? 'Геометки' : 'Geometki'}` })}
                <meta charSet={'utf-8'} />
                <meta
                    name={'mobile-web-app-capable'}
                    content={'yes'}
                />
                {/* viewport-fit=cover: the page reaches under the notch and the home indicator, the fixed
                    bars keep their content clear with env(safe-area-inset-*) */}
                <meta
                    name={'viewport'}
                    content={'width=device-width, initial-scale=1, viewport-fit=cover'}
                />
                {/* iOS installed app: an opaque status bar above the page with dark text. With
                    black-translucent the text is white and unreadable over the white app bar */}
                <meta
                    name={'apple-mobile-web-app-status-bar-style'}
                    content={'default'}
                />
                <meta
                    name={'apple-mobile-web-app-title'}
                    content={i18n.language === 'en' ? 'Geometki' : 'Геометки'}
                />
                <link
                    rel={'apple-touch-icon'}
                    sizes={'180x180'}
                    href={'/apple-touch-icon.png'}
                />
                <link
                    rel={'icon'}
                    type={'image/png'}
                    sizes={'32x32'}
                    href={'/favicon-32x32.png'}
                />
                <link
                    rel={'icon'}
                    type={'image/png'}
                    sizes={'16x16'}
                    href={'/favicon-16x16.png'}
                />
                <link
                    rel={'icon'}
                    href={'/favicon.ico'}
                    type={'image/x-icon'}
                />
                <link
                    rel={'manifest'}
                    href={i18n.language === 'en' ? '/site.en.webmanifest' : '/site.webmanifest'}
                />
            </Head>

            <ThemeColor />

            <Provider store={store}>
                <Component {...pageProps} />
            </Provider>

            {process.env.NODE_ENV === 'production' && (
                <>
                    {/* Analytics loads when the browser is idle after the page load: the counters do not
                        compete with the page's own code for the main thread (TBT, INP) */}
                    {/* Yandex.Metrika counter */}
                    <Script
                        id={'yandex-metrika'}
                        strategy={'lazyOnload'}
                    >
                        {`
                            (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
                            m[i].l=1*new Date();
                            for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
                            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
                            (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

                            ym(96500810, "init", {
                                webvisor:true,
                                clickmap:true,
                                referrer: document.referrer,
                                url: location.href,
                                accurateTrackBounce:true,
                                trackLinks:true
                            });
                        `}
                    </Script>
                    <noscript>
                        <div>
                            <img
                                src={'https://mc.yandex.ru/watch/96500810'}
                                style={{ position: 'absolute', left: '-9999px' }}
                                alt={''}
                            />
                        </div>
                    </noscript>

                    {/* Google Analytics */}
                    <Script
                        src={'https://www.googletagmanager.com/gtag/js?id=G-JTW79QN3MM'}
                        strategy={'lazyOnload'}
                    />
                    <Script
                        id={'google-analytics'}
                        strategy={'lazyOnload'}
                    >
                        {`
                            window.dataLayer = window.dataLayer || [];
                            function gtag(){dataLayer.push(arguments);}
                            gtag('js', new Date());
                            gtag('config', 'G-JTW79QN3MM');
                        `}
                    </Script>
                </>
            )}
        </ThemeProvider>
    )
}

/**
 * The texts come from the config, not from the page props: on the server from the files
 * (utils/translations.server.ts, loaded by every page's data function), in the browser from the
 * locale script that runs before the app (pages/_document.tsx). A page's data then carries no
 * translations: ~20 KB less in every HTML and every client-side navigation. A getter: the
 * browser may add a locale later (a language switch)
 */
const i18nConfig = {
    ...i18Config,
    get resources() {
        return globalThis.__GEOMETKI_I18N__
    }
}

export default appWithTranslation(App, i18nConfig)
