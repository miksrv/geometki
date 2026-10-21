import React, { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import { Button, cn, Icon } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'
import { openAuthDialog } from '@/app/applicationSlice'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { Section } from '@/components/shared'

import styles from './styles.module.sass'

// Collapsed height of a long description (about 18 lines of prose, 15 on phones; the same
// as `.clamped` in the styles); shorter texts are never clamped
const CLAMP_HEIGHT = 540
const CLAMP_HEIGHT_PHONE = 420
// A markdown source longer than this is almost certainly taller than the clamp: the server
// renders the "Читать полностью" control for it right away, so it does not appear after
// hydration and push the page down (CLS); the measurement below corrects the rare miss
const LIKELY_LONG_LENGTH = 1200
// A text between these two may or may not be taller than the clamp (headings, lists and short
// lines make it taller): its control row is reserved from the first paint, so the measurement
// after hydration only fills it or leaves it empty, and nothing below moves
const MAYBE_LONG_LENGTH = 400

// The page has its own h2 sections: headings inside the text are one level below them
const markdownComponents = {
    h1: ({ children }: { children?: React.ReactNode }) => <h3>{children}</h3>,
    h2: ({ children }: { children?: React.ReactNode }) => <h3>{children}</h3>
}

interface PlaceDescriptionProps {
    placeId?: string
    content?: string
    /** The locale of `content`: another one than the interface locale when the place is not translated */
    locale?: ApiType.Locale
    tags?: string[]
}

/**
 * The text of the place — the main thing of the page, read only: no visible heading, the
 * reading typography with a lead, a long text clamped with a fade, the tags as quiet chips at
 * its end. The text is edited in the place form only ("⋯ → Редактировать"); a place without
 * a text links there.
 */
export const PlaceDescription: React.FC<PlaceDescriptionProps> = ({ placeId, content, locale }) => {
    const dispatch = useAppDispatch()
    const { t, i18n } = useTranslation()

    // The shown text is the original in another language
    const isUntranslated = !!locale && locale !== i18n.language

    const isAuth = useAppSelector((state) => state.auth.isAuth)

    const contentRef = useRef<HTMLDivElement>(null)

    // Clamped until measured: the server HTML and the first client render agree, and a
    // short text is simply shorter than the limit. Expanded for good when it fits.
    const [clamped, setClamped] = useState<boolean>(true)
    const [overflows, setOverflows] = useState<boolean>((content?.length ?? 0) > LIKELY_LONG_LENGTH)

    const reserveReadMore = !overflows && (content?.length ?? 0) > MAYBE_LONG_LENGTH

    // The edit page is for signed-in users only: a guest gets the sign-in dialog instead
    const handleEditClick = (event: React.MouseEvent) => {
        if (!isAuth) {
            event.preventDefault()
            dispatch(openAuthDialog())
        }
    }

    useEffect(() => {
        const element = contentRef.current

        if (!element) {
            return
        }

        // Strict: a text within the limit is shown whole, a taller one is clamped at the limit
        // exactly, so the toggle never changes the height by a few pixels
        const limit = window.matchMedia('(max-width: 768px)').matches ? CLAMP_HEIGHT_PHONE : CLAMP_HEIGHT
        const fits = element.scrollHeight <= limit

        setOverflows(!fits)

        if (fits) {
            setClamped(false)
        }
    }, [content])

    return (
        // The text is the main thing of the page: no visible heading, it starts right under the hero
        <Section
            className={styles.placeDescription}
            title={t('description')}
            titleHidden={true}
        >
            {isUntranslated && (
                <div className={styles.untranslated}>
                    {t('place-text-untranslated', { language: t(`language-name-${locale}`) })}
                    {isAuth && (
                        <>
                            {' · '}
                            <Link href={`/places/${placeId}/edit?lang=${i18n.language}`}>{t('translate')}</Link>
                        </>
                    )}
                </div>
            )}

            {content ? (
                <>
                    <div
                        ref={contentRef}
                        className={cn(styles.content, clamped && styles.clamped)}
                    >
                        <Markdown components={markdownComponents}>{content}</Markdown>
                    </div>
                    {overflows && (
                        <Button
                            unstyled={true}
                            className={cn(styles.readMore, !clamped && styles.expanded)}
                            aria-expanded={!clamped}
                            onClick={() => setClamped((prev) => !prev)}
                        >
                            {clamped
                                ? t('read-full-text', { defaultValue: 'Читать полностью' })
                                : t('collapse-text', { defaultValue: 'Свернуть' })}
                            <Icon name={'KeyboardDown'} />
                        </Button>
                    )}
                    {reserveReadMore && (
                        <div
                            className={styles.readMoreSpace}
                            aria-hidden={true}
                        />
                    )}
                </>
            ) : (
                <div className={styles.emptyContent}>
                    {t('description-not-added-yet')}
                    {' · '}
                    <Link
                        href={`/places/${placeId}/edit`}
                        onClick={handleEditClick}
                    >
                        {t('add', { defaultValue: 'Добавить' })}
                    </Link>
                </div>
            )}

            {/* TEMPORARILY OFF (1.17.6): the tags are being reworked, and the list of a tag is not
                served now (proxy.ts), so the page does not link to it. The quiet end of the text: its
                tags as chips */}
            {/* {!!tags?.length && (
                <ul className={styles.tagList}>
                    {tags.map((tag, i) => (
                        <li key={`tag${i}`}>
                            <Link
                                href={`/places?tag=${tag}`}
                                title={`#${tag}`}
                            >
                                {`#${tag}`}
                            </Link>
                        </li>
                    ))}
                </ul>
            )} */}
        </Section>
    )
}
