import React from 'react'
import { Button } from 'simple-react-ui-kit'

import type { NextPage } from 'next'
import Head from 'next/head'
import { useTranslation } from 'next-i18next/pages'
import { generateNextSeo } from 'next-seo/pages'

import { ApiType } from '@/api'
import { AppLayout, PageHeader, Section } from '@/components/shared'
import { TableOfContents } from '@/components/ui'
import type { TableOfContentsItem } from '@/components/ui/table-of-contents'
import { SITE_LINK } from '@/config/env'
import { GAME_HELP_HREF, GAME_HREF } from '@/utils/game'
import { buildHreflangTags } from '@/utils/seo'

import { GamePointsTable } from '../game-rules'

import styles from './styles.module.sass'

export interface HelpPageProps {
    /** The text of the page as HTML, from `content/game-help.<locale>.md` */
    content: string
    /** The `##` sections of the text, for the contents in the side column */
    headings?: TableOfContentsItem[]
    /** The numbers of the game, for the table under the text */
    rules?: ApiType.Game.Rules | null
}

/**
 * "Как играть" (`/game/help`): the mechanics of the game in plain words, an article to read in
 * the page's two columns — the text (steps and short sections, no numbers of the formula) in
 * the main one; in the side one the way into the game, the table of points for those
 * who want the exact numbers (folded). The text is a Markdown file (`client/content`), not a
 * locale key.
 */
export const HelpPage: NextPage<HelpPageProps> = ({ content, headings = [], rules }) => {
    const { t, i18n } = useTranslation()

    const pageUrl = `${SITE_LINK}${i18n.language === 'en' ? 'en/' : ''}${GAME_HELP_HREF.replace(/^\//, '')}`

    return (
        <AppLayout>
            <Head>
                {generateNextSeo({
                    title: t('game-help-seo-title'),
                    description: t('game-help-seo-description'),
                    canonical: pageUrl,
                    noindex: false,
                    nofollow: false,
                    openGraph: {
                        description: t('game-help-seo-description'),
                        locale: i18n.language === 'ru' ? 'ru_RU' : 'en_US',
                        siteName: t('geotags'),
                        title: t('game-help-seo-title'),
                        type: 'article',
                        url: pageUrl
                    },
                    additionalLinkTags: buildHreflangTags(GAME_HELP_HREF.replace(/^\//, ''))
                })}
            </Head>

            <PageHeader
                breadcrumbs={[{ link: GAME_HREF, text: t('game-title') }]}
                title={t('game-rules-title')}
            />

            <div className={styles.columns}>
                <article
                    className={styles.prose}
                    dangerouslySetInnerHTML={{ __html: content }}
                />

                <aside className={styles.side}>
                    <div className={styles.start}>
                        <p>{t('game-help-start-text')}</p>
                        <Button
                            mode={'primary'}
                            size={'medium'}
                            stretched={true}
                            link={GAME_HREF}
                            label={t('game-help-start')}
                        />
                    </div>

                    {rules && (
                        <Section
                            level={3}
                            title={t('game-help-table-title')}
                        >
                            <p className={styles.lede}>{t('game-help-table-lede')}</p>
                            <GamePointsTable rules={rules} />
                        </Section>
                    )}

                    <TableOfContents
                        className={styles.contents}
                        items={headings}
                        label={t('page-contents')}
                    />
                </aside>
            </div>
        </AppLayout>
    )
}
