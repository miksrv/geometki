import type { Metadata } from 'next'
import { headers } from 'next/headers'

import { getNotFoundTexts, NotFoundPage } from '@/components/shared/not-found-page'
import { LOCALE_HEADER } from '@/config/constants'

import en from '../public/locales/en/common.json'
import ru from '../public/locales/ru/common.json'

// Every 404 of the site lands here, also on /en (the `app` folder turns the App Router on and its
// not-found takes over pages/404.tsx). The Pages Router i18n does not reach this page: the proxy
// passes the request's locale in a header and the texts come straight from the locale file
const getLocale = async (): Promise<'en' | 'ru'> => ((await headers()).get(LOCALE_HEADER) === 'en' ? 'en' : 'ru')

const getTexts = async () => {
    const dictionary: Record<string, unknown> = (await getLocale()) === 'en' ? en : ru

    return getNotFoundTexts((key, { defaultValue }) =>
        typeof dictionary[key] === 'string' ? (dictionary[key] as string) : defaultValue
    )
}

export const generateMetadata = async (): Promise<Metadata> => {
    const locale = await getLocale()
    const texts = await getTexts()

    return {
        robots: {
            follow: false,
            index: false
        },
        title: `${texts.title} | ${locale === 'en' ? 'Geometki' : 'Геометки'}`
    }
}

export default async function NotFound() {
    const locale = await getLocale()

    return (
        <NotFoundPage
            texts={await getTexts()}
            homeHref={locale === 'en' ? '/en' : '/'}
        />
    )
}
