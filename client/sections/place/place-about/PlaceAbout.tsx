import React from 'react'
import { Container, Icon } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { Section, UserAvatar } from '@/components/shared'
import { formatDate, formatThousands } from '@/utils/helpers'

import { PlaceActivity } from '../place-activity/PlaceActivity'

import styles from './styles.module.sass'

/** Editors shown as faces in the byline; the count names them all */
const MAX_EDITOR_FACES = 3

interface PlaceAboutProps {
    place?: ApiModel.Place
    /** Photos of the place as the page shows them (uploads and links included) */
    photosCount?: number
}

/**
 * "О месте" — the byline under the article: who added the place and when, who else edited it
 * (their faces and count, a line of their own under the dates),
 * the views and the photos, then the collapsed change history (`PlaceActivity`). What
 * matters to the community, out of the way of reading.
 */
export const PlaceAbout: React.FC<PlaceAboutProps> = ({ place, photosCount }) => {
    const { t } = useTranslation()

    if (!place) {
        return null
    }

    const dateFormat = t('date-format')
    const created = place.created?.date
    const updated = place.updated?.date
    const editors = place.editors?.filter(({ id }) => id !== place.author?.id) ?? []

    const dates = [
        t('author', { defaultValue: 'Автор' }),
        created && t('place-added-on', { date: formatDate(created, dateFormat), defaultValue: 'добавлено {{date}}' }),
        updated &&
            updated !== created &&
            t('place-updated-on', { date: formatDate(updated, dateFormat), defaultValue: 'обновлено {{date}}' })
    ].filter(Boolean)

    return (
        <Section title={t('place-about-title', { defaultValue: 'О месте' })}>
            <Container className={styles.card}>
                <div className={styles.byline}>
                    {place.author && (
                        <>
                            <UserAvatar
                                user={place.author}
                                size={'medium'}
                            />
                            <div className={styles.who}>
                                <Link
                                    href={`/users/${place.author.id}`}
                                    className={styles.name}
                                >
                                    {place.author.name}
                                </Link>
                                <span
                                    className={styles.meta}
                                    suppressHydrationWarning={true}
                                >
                                    {dates.join(' · ')}
                                </span>
                                {/* Who else edited the place: always a line of its own under the dates */}
                                {!!editors.length && (
                                    <span className={styles.editors}>
                                        <span className={styles.faces}>
                                            {editors.slice(0, MAX_EDITOR_FACES).map((editor) => (
                                                <UserAvatar
                                                    key={editor.id}
                                                    user={editor}
                                                    size={'small'}
                                                    hideOnlineIcon={true}
                                                />
                                            ))}
                                        </span>
                                        {t('place-editors-count', {
                                            count: editors.length,
                                            defaultValue: '{{count}} редакторов'
                                        })}
                                    </span>
                                )}
                            </div>
                        </>
                    )}

                    <ul className={styles.stats}>
                        <li>
                            <Icon name={'Eye'} />
                            {t('place-views-count', {
                                count: place.views ?? 0,
                                formatted: formatThousands(place.views ?? 0),
                                defaultValue: '{{formatted}} просмотров'
                            })}
                        </li>
                        {!!photosCount && (
                            <li>
                                <Icon name={'Camera'} />
                                {t('photos-count', { count: photosCount, defaultValue: '{{count}} фото' })}
                            </li>
                        )}
                    </ul>
                </div>

                <PlaceActivity placeId={place.id} />
            </Container>
        </Section>
    )
}
