import { headers } from 'next/headers'

import { LOCALE_HEADER } from '@/config/constants'

import '@/styles/theme.css'
import '@/styles/globals.sass'

export default async function NotFoundLayout({ children }: { children: React.ReactNode }) {
    const locale = (await headers()).get(LOCALE_HEADER) === 'en' ? 'en' : 'ru'

    return (
        <html lang={locale}>
            <body>{children}</body>
        </html>
    )
}
