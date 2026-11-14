import React, { useState } from 'react'
import type { SlideImage } from 'yet-another-react-lightbox'

import type { NextPage } from 'next'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { generateNextSeo } from 'next-seo/pages'

import { AppLayout, PageHeader } from '@/components/shared'
import { TableOfContents } from '@/components/ui'
import type { TableOfContentsItem } from '@/components/ui/table-of-contents'
import { SITE_LINK } from '@/config/env'
import { buildHreflangTags } from '@/utils/seo'

import styles from './styles.module.sass'

const ContentLightbox = dynamic(() => import('./ContentLightbox').then((m) => ({ default: m.ContentLightbox })), {
    ssr: false
})

/** The photos of the text as the lightbox's slides: the large size, the alt text as the caption */
const slidesOf = (article: HTMLElement): SlideImage[] =>
    Array.from(article.querySelectorAll<HTMLImageElement>('.content-photo img')).map((image) => ({
        alt: image.alt,
        description: image.alt || undefined,
        // The shape of the photo, from its loaded size in the row: the lightbox lays it out at once
        height: image.naturalWidth ? Math.round((image.naturalHeight / image.naturalWidth) * 1920) : undefined,
        src: image.dataset.full ?? image.src,
        width: image.naturalWidth ? 1920 : undefined
    }))

export interface ContentPageProps {
    /** The page's path without the locale and the leading slash, `about` */
    path: string
    /** The text of the page as HTML, from `content/<page>.<locale>.md` */
    content: string
    /** The `##` sections of the text, for the contents beside it */
    headings: TableOfContentsItem[]
    /** The title and the SEO description, from the file's front matter */
    title: string
    description: string
}

/**
 * A static page to read ("О проекте", "Правила"): the text on the full width and its sections in
 * a sticky column on the right (`TableOfContents`). The whole page — title, description and
 * text — is a Markdown file (`client/content`); its photos open in a lightbox. The data function is `getContentPageProps()`.
 */
export const ContentPage: NextPage<ContentPageProps> = ({ path, content, headings, title, description }) => {
    const { t, i18n } = useTranslation()

    const [lightbox, setLightbox] = useState<{ slides: SlideImage[]; index: number }>({ index: -1, slides: [] })

    // The photos are server-rendered HTML: one listener on the text opens the one clicked
    const handleTextClick = (event: React.MouseEvent<HTMLElement>) => {
        const photo = (event.target as HTMLElement).closest('.content-photo')

        if (!photo) {
            return
        }

        const photos = Array.from(event.currentTarget.querySelectorAll('.content-photo'))

        setLightbox({ index: photos.indexOf(photo), slides: slidesOf(event.currentTarget) })
    }

    const pageUrl = `${SITE_LINK}${i18n.language === 'en' ? 'en/' : ''}${path}`

    return (
        <AppLayout>
            <Head>
                {generateNextSeo({
                    title,
                    description,
                    canonical: pageUrl,
                    noindex: false,
                    nofollow: false,
                    openGraph: {
                        description,
                        locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US',
                        siteName: t('geotags'),
                        title,
                        type: 'article',
                        url: pageUrl
                    },
                    additionalLinkTags: buildHreflangTags(path)
                })}
            </Head>

            <PageHeader title={title} />

            <div className={styles.columns}>
                <article
                    className={styles.prose}
                    dangerouslySetInnerHTML={{ __html: content }}
                    onClick={handleTextClick}
                />

                <aside className={styles.side}>
                    <TableOfContents
                        items={headings}
                        label={t('page-contents')}
                    />
                </aside>
            </div>

            {lightbox.index >= 0 && (
                <ContentLightbox
                    slides={lightbox.slides}
                    index={lightbox.index}
                    onClose={() => setLightbox((state) => ({ ...state, index: -1 }))}
                />
            )}
        </AppLayout>
    )
}
