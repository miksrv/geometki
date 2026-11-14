import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Markdown from 'react-markdown'

import { readFileSync } from 'fs'
import { join } from 'path'

/** The pages whose texts are Markdown files in `client/content` (`<page>.<locale>.md`) */
export type ContentPage = 'about' | 'game-help' | 'rules'

const FALLBACK_LOCALE = 'ru'

/** A `##` section of a page: the anchor of its heading and its text, for the page's contents */
export interface ContentHeading {
    id: string
    title: string
}

/** A page's text, its sections and the fields of its front matter (`title`, `description`) */
export interface ContentPageData {
    html: string
    headings: ContentHeading[]
    title: string
    description: string
}

const cache = new Map<string, ContentPageData>()

interface HastNode {
    type: string
    tagName?: string
    value?: string
    children?: HastNode[]
}

// Widths of the photos of a page made by the Next.js image optimizer (`/_next/image`, cached on
// the server): every one of them is a default `deviceSizes` width; quality is one of `qualities`
const PHOTO_WIDTHS = [640, 828, 1080, 1920]
const PHOTO_FULL_WIDTH = 1920
const PHOTO_QUALITY = 75
// A row of photos holds at most this many; more go on the next rows
const GALLERY_COLUMNS = 4

/** A photo of the site's own (`/images/...`) through the optimizer; any other link as is */
const optimized = (src: string, width: number): string =>
    src.startsWith('/') ? `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${PHOTO_QUALITY}` : src

/** A paragraph of nothing but images (`![a](x) ![b](y)` on one line or on adjacent lines) */
const isGallery = (node?: HastNode): boolean => {
    const children = node?.children ?? []

    return (
        children.some((child) => child.tagName === 'img') &&
        children.every((child) => child.tagName === 'img' || (child.type === 'text' && !child.value?.trim()))
    )
}

const textOf = (node?: HastNode): string =>
    node?.type === 'text' ? (node.value ?? '') : (node?.children ?? []).map(textOf).join('')

/** An anchor of a heading in its own language: «С чего всё началось» → `с-чего-всё-началось` */
const slugify = (text: string): string =>
    text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '')

/**
 * Renders the Markdown, giving every `##` an id; the headings it met are returned for the page's
 * contents (ids made unique by a number: two sections of one name)
 */
const render = (source: string): { html: string; headings: ContentHeading[] } => {
    const headings: ContentHeading[] = []
    const used = new Map<string, number>()

    const html = renderToStaticMarkup(
        <Markdown
            components={{
                h2: ({ node, children }) => {
                    const title = textOf(node as HastNode).trim()
                    const base = slugify(title) || 'section'
                    const count = (used.get(base) ?? 0) + 1
                    const id = count > 1 ? `${base}-${count}` : base

                    used.set(base, count)
                    headings.push({ id, title })

                    return <h2 id={id}>{children}</h2>
                },
                // A photo is a button of the page's lightbox: the optimizer's sizes for the row,
                // the large one for the lightbox (`data-full`), the alt text as its caption
                img: ({ src, alt }) => {
                    const link = typeof src === 'string' ? src : ''

                    return (
                        <button
                            type={'button'}
                            className={'content-photo'}
                            aria-label={alt || undefined}
                        >
                            <img
                                src={optimized(link, 1080)}
                                srcSet={
                                    link.startsWith('/')
                                        ? PHOTO_WIDTHS.map((width) => `${optimized(link, width)} ${width}w`).join(', ')
                                        : undefined
                                }
                                sizes={'(max-width: 768px) 50vw, 25vw'}
                                alt={alt ?? ''}
                                loading={'lazy'}
                                decoding={'async'}
                                data-full={optimized(link, PHOTO_FULL_WIDTH)}
                            />
                        </button>
                    )
                },
                // Photos in a paragraph of their own are a row (several rows past four): the
                // columns are as many as the photos, at most four (`data-columns`)
                p: ({ node, children }) => {
                    if (!isGallery(node as HastNode)) {
                        return <p>{children}</p>
                    }

                    const count = (node as HastNode).children?.filter((child) => child.tagName === 'img').length ?? 0

                    return (
                        <div
                            className={'content-gallery'}
                            data-columns={Math.min(count, GALLERY_COLUMNS)}
                        >
                            {children}
                        </div>
                    )
                }
            }}
        >
            {source}
        </Markdown>
    )

    return { headings, html }
}

const read = (page: ContentPage, locale: string): string | undefined => {
    try {
        return readFileSync(join(process.cwd(), 'content', `${page}.${locale}.md`), 'utf8')
    } catch {
        return undefined
    }
}

/**
 * Splits the front matter off a file: a `---` block of `key: value` lines on top (no YAML beyond
 * that — the values are one line of plain text).
 */
const splitFrontMatter = (source: string): { body: string; fields: Record<string, string> } => {
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source)

    if (!match) {
        return { body: source, fields: {} }
    }

    const fields: Record<string, string> = {}

    for (const line of match[1].split(/\r?\n/)) {
        const separator = line.indexOf(':')

        if (separator > 0) {
            fields[line.slice(0, separator).trim()] = line.slice(separator + 1).trim()
        }
    }

    return { body: source.slice(match[0].length), fields }
}

/**
 * A static page from its Markdown file of the locale (the Russian one when there is none),
 * rendered on the server — the page shows the HTML as is, the browser loads neither the other
 * language nor a Markdown parser. The front matter gives the page's `title` (its `h1` and SEO
 * title) and `description` (SEO), so the whole page lives in one file. `##` stays an `h2`: the
 * file holds the sections of a whole page, unlike a place's description
 * (`utils/markdown.server.tsx`); every `##` gets an id, `headings` lists them for the page's
 * contents (`TableOfContents`); a paragraph of images only is a row of photos for the lightbox
 * (`content-gallery`, served by the Next.js optimizer). Raw HTML in the source is escaped. Kept in memory after the first
 * read; a changed file shows up on reload in development. Server only: import it from data
 * functions, never from a component.
 */
export const loadContentPage = (page: ContentPage, locale?: string): ContentPageData => {
    const key = `${page}.${locale ?? FALLBACK_LOCALE}`
    const cached = process.env.NODE_ENV === 'development' ? undefined : cache.get(key)

    if (cached !== undefined) {
        return cached
    }

    const source = read(page, locale ?? FALLBACK_LOCALE) ?? read(page, FALLBACK_LOCALE) ?? ''
    const { body, fields } = splitFrontMatter(source)
    const { html, headings } = body ? render(body) : { headings: [], html: '' }
    const data: ContentPageData = { description: fields.description ?? '', headings, html, title: fields.title ?? '' }

    cache.set(key, data)

    return data
}

/** The text of a static page as HTML, for a page whose title and SEO are locale keys */
export const loadContent = (page: ContentPage, locale?: string): string => loadContentPage(page, locale).html
