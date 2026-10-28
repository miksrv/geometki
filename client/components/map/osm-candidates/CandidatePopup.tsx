import React, { useState } from 'react'
import { Badge, Button, cn, Icon } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'
import useRequireAuth from '@/hooks/useRequireAuth'
import { buildPlaceUrl } from '@/utils/helpers'

import { breakdownText, displayName, settlementText, wikipediaUrl } from './utils'

import styles from './styles.module.sass'

/** Score signals that tell a visitor something about the place; the rest (tags, contours, names) are for us */
const VISITOR_FACTS = new Set<ApiType.OsmCandidates.BreakdownCode>([
    'wiki',
    'nearbyWiki',
    'sitelinks',
    'protected',
    'salt',
    'lakeSize'
])

interface CandidatePopupProps {
    candidate: ApiType.OsmCandidates.Candidate
}

/**
 * Popup of an OSM candidate on the map: the cover (a Commons photo with its credits, or an OSM image),
 * what and where the object is, a few facts about it, the sources and the "create a place" action.
 */
export const CandidatePopup: React.FC<CandidatePopupProps> = ({ candidate }) => {
    const { t, i18n } = useTranslation()
    const requireAuth = useRequireAuth()

    const [coverFailed, setCoverFailed] = useState(false)

    const locale = i18n.language
    const title = displayName(t, candidate, locale)
    const settlement = settlementText(t, candidate, locale)
    const photo = candidate.photos[0]
    const coverUrl = coverFailed ? undefined : (photo?.url ?? candidate.image ?? undefined)
    const morePhotos = candidate.photos.length - 1

    // Named: "Озеро · 125 м"; unnamed objects already have the type in the title
    const subline = [
        candidate.name ? candidate.typeTitle : undefined,
        candidate.ele
            ? t('osm-candidates_elevation', { defaultValue: '{{value}} м', value: Math.round(candidate.ele) })
            : undefined,
        candidate.name ? undefined : t('osm-candidates_no-name', { defaultValue: 'Название неизвестно' })
    ].filter(Boolean)

    const articleUrl = candidate.wikipedia ? wikipediaUrl(candidate.wikipedia) : undefined

    // The article link already says there is an article
    const facts = candidate.breakdown.filter(
        (item) => item.points > 0 && VISITOR_FACTS.has(item.code) && !(item.code === 'wiki' && articleUrl)
    )

    const sources = [
        articleUrl
            ? {
                  href: articleUrl,
                  label: t('osm-candidates_wikipedia', { defaultValue: 'Википедия' })
              }
            : undefined,
        candidate.osmType && candidate.osmId
            ? {
                  href: `https://www.openstreetmap.org/${candidate.osmType}/${candidate.osmId}`,
                  label: 'OpenStreetMap'
              }
            : undefined
    ].filter((source): source is { href: string; label: string } => !!source)

    return (
        <article className={cn(styles.popup, !coverUrl && styles.noCover)}>
            {coverUrl && (
                <figure className={styles.cover}>
                    <div className={styles.coverImage}>
                        <img
                            src={coverUrl}
                            alt={title}
                            loading={'lazy'}
                            onError={() => setCoverFailed(true)}
                        />
                        {photo && morePhotos > 0 && (
                            <span
                                className={styles.coverCounter}
                                aria-label={t('osm-candidates_more-photos', {
                                    defaultValue: 'ещё фото: {{value}}',
                                    value: morePhotos
                                })}
                            >
                                <Icon name={'Photo'} />
                                {`+${morePhotos}`}
                            </span>
                        )}
                    </div>

                    {/* Commons photos are shown only with their author and licence; an OSM image has no known licence */}
                    {photo && (
                        <figcaption>
                            <a
                                href={photo.page ?? undefined}
                                target={'_blank'}
                                rel={'noreferrer'}
                                title={[photo.author, photo.license].filter(Boolean).join(' · ')}
                            >
                                {[photo.author, photo.license, 'Wikimedia Commons'].filter(Boolean).join(' · ')}
                            </a>
                        </figcaption>
                    )}
                </figure>
            )}

            <div className={styles.body}>
                <header className={styles.popupHeader}>
                    <h3 className={styles.title}>{title}</h3>
                    {subline.length > 0 && <div className={styles.subline}>{subline.join(' · ')}</div>}
                    {settlement && (
                        <div className={styles.settlement}>
                            <Icon name={'Point'} />
                            <span>{settlement}</span>
                        </div>
                    )}
                </header>

                <div className={styles.badges}>
                    <Badge
                        size={'small'}
                        icon={'Search'}
                        label={t('white-spots_badge', { defaultValue: 'Не открыто' })}
                        tooltip={t('white-spots_hint', {
                            defaultValue:
                                'Это место ещё никто не открыл на Геометках: оно есть в OpenStreetMap, но без описания'
                        })}
                        tabIndex={0}
                    />
                    {candidate.heritage && (
                        <Badge
                            size={'small'}
                            icon={'Award'}
                            label={t('osm-candidates_heritage-short', { defaultValue: 'Наследие' })}
                            tooltip={t('osm-candidates_heritage-code', {
                                code: candidate.heritage,
                                defaultValue: 'Объект культурного наследия, № {{code}}'
                            })}
                            tabIndex={0}
                        />
                    )}
                </div>

                {facts.length > 0 && (
                    <ul className={styles.facts}>
                        {facts.map((item, index) => (
                            <li key={`${item.code}${index}`}>
                                <Icon name={'CheckCircle'} />
                                <span>{breakdownText(t, item)}</span>
                            </li>
                        ))}
                    </ul>
                )}

                {sources.length > 0 && (
                    <div className={styles.sources}>
                        {sources.map((source) => (
                            <a
                                key={source.label}
                                href={source.href}
                                target={'_blank'}
                                rel={'noreferrer'}
                            >
                                {source.label}
                                <Icon name={'External'} />
                            </a>
                        ))}
                    </div>
                )}

                {candidate.place && (
                    <div className={styles.callout}>
                        <span className={styles.calloutLabel}>
                            {candidate.status === 'linked'
                                ? t('osm-candidates_linked-to', { defaultValue: 'Связано с геометкой:' })
                                : t('osm-candidates_looks-like', { defaultValue: 'Похоже на геометку:' })}
                        </span>
                        <Link
                            className={styles.calloutLink}
                            href={buildPlaceUrl(candidate.place.id)}
                            target={'_blank'}
                        >
                            {candidate.place.title ?? candidate.place.id}
                        </Link>
                    </div>
                )}

                {candidate.status !== 'linked' && (
                    <div className={styles.cta}>
                        {candidate.status === 'open' && (
                            <span className={styles.ctaText}>
                                {t('white-spots_cta', {
                                    defaultValue: 'Откройте это место первым: +35 опыта'
                                })}
                            </span>
                        )}
                        <Button
                            stretched={true}
                            mode={'primary'}
                            size={'small'}
                            link={`/places/create?candidate=${candidate.id}`}
                            noIndex={true}
                            onClick={requireAuth}
                            label={t('white-spots_create', { defaultValue: 'Добавить это место' })}
                        />
                    </div>
                )}
            </div>
        </article>
    )
}
