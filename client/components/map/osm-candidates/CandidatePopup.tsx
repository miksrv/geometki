import React, { useState } from 'react'
import { Badge, Button, cn, Icon } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiType } from '@/api'
import { Notify } from '@/app/notificationSlice'
import { useAppDispatch } from '@/app/store'
import { getErrorMessage } from '@/utils/api'
import { buildPlaceUrl } from '@/utils/helpers'

import { GROUP_COLORS, useGroupHints, useGroupTitles } from './constants'
import { breakdownText, candidateGroup, displayName, formatPoints, settlementText, wikipediaUrl } from './utils'

import styles from './styles.module.sass'

const ConfirmationDialog = dynamic(() => import('@/components/shared/confirmation-dialog/ConfirmationDialog'), {
    ssr: false
})

interface CandidatePopupProps {
    candidate: ApiType.OsmCandidates.Candidate
    isAdmin?: boolean
}

type AdminAction = 'link' | 'unlink' | 'reject'

/**
 * Popup of an OSM candidate on the map: the cover (a Commons photo with its credits, or an OSM image),
 * what and where the object is, why it got its rating, the "create a place" action and the sources.
 * Admins also see the objects that are already on Geometki and can link, unlink or hide them.
 */
export const CandidatePopup: React.FC<CandidatePopupProps> = ({ candidate, isAdmin }) => {
    const { t, i18n } = useTranslation()
    const dispatch = useAppDispatch()
    const groupTitles = useGroupTitles()
    const groupHints = useGroupHints()

    const [pending, setPending] = useState<AdminAction>()
    const [confirmReject, setConfirmReject] = useState(false)
    const [coverFailed, setCoverFailed] = useState(false)

    const [link] = API.useOsmCandidatesPatchLinkMutation()
    const [unlink] = API.useOsmCandidatesPatchUnlinkMutation()
    const [reject] = API.useOsmCandidatesPatchRejectMutation()

    const locale = i18n.language
    const group = candidateGroup(candidate)
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

    const sources = [
        candidate.osmType && candidate.osmId
            ? {
                  href: `https://www.openstreetmap.org/${candidate.osmType}/${candidate.osmId}`,
                  label: 'OSM'
              }
            : undefined,
        articleUrl
            ? {
                  href: articleUrl,
                  label: t('osm-candidates_wikipedia', { defaultValue: 'Википедия' })
              }
            : undefined,
        candidate.wikidata
            ? { href: `https://www.wikidata.org/wiki/${candidate.wikidata}`, label: 'Wikidata' }
            : undefined
    ].filter((source): source is { href: string; label: string } => !!source)

    const run = async (action: AdminAction, request: () => Promise<unknown>, success: string) => {
        setPending(action)

        try {
            await request()
            void dispatch(Notify({ id: 'osmCandidateAction', message: success, type: 'success' }))
        } catch (error) {
            void dispatch(Notify({ id: 'osmCandidateError', message: getErrorMessage(error), type: 'error' }))
        } finally {
            setPending(undefined)
        }
    }

    const handleLink = (id: string) =>
        run(
            'link',
            () => link({ id: candidate.id, placeId: id }).unwrap(),
            t('osm-candidates_linked', { defaultValue: 'Объект связан с геометкой' })
        )

    const handleUnlink = () =>
        run(
            'unlink',
            () => unlink(candidate.id).unwrap(),
            t('osm-candidates_unlinked', { defaultValue: 'Связь с геометкой удалена' })
        )

    const handleReject = () => {
        setConfirmReject(false)
        void run(
            'reject',
            () => reject(candidate.id).unwrap(),
            t('osm-candidates_rejected', { defaultValue: 'Объект скрыт с карты' })
        )
    }

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
                        className={styles.groupBadge}
                        icon={
                            <span
                                className={styles.dot}
                                style={{ background: GROUP_COLORS[group] }}
                            />
                        }
                        label={groupTitles[group]}
                        tooltip={groupHints[group]}
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
                        {isAdmin && candidate.place.similarity !== undefined && (
                            <span className={styles.calloutLabel}>
                                {t('osm-candidates_similarity', {
                                    defaultValue: 'Совпадение названия: {{value}}%',
                                    value: candidate.place.similarity
                                })}
                            </span>
                        )}

                        {isAdmin && candidate.status === 'duplicate' && (
                            <Button
                                stretched={true}
                                size={'small'}
                                mode={'secondary'}
                                icon={'CheckCircle'}
                                loading={pending === 'link'}
                                disabled={!!pending}
                                label={t('osm-candidates_confirm-link', { defaultValue: 'Подтвердить связь' })}
                                onClick={() => handleLink(candidate.place!.id)}
                            />
                        )}

                        {isAdmin && candidate.status === 'linked' && (
                            <Button
                                stretched={true}
                                size={'small'}
                                mode={'secondary'}
                                loading={pending === 'unlink'}
                                disabled={!!pending}
                                label={t('osm-candidates_unlink', { defaultValue: 'Отвязать' })}
                                onClick={handleUnlink}
                            />
                        )}
                    </div>
                )}

                {candidate.status !== 'linked' && (
                    <Button
                        stretched={true}
                        mode={'primary'}
                        size={'medium'}
                        icon={'PlusCircle'}
                        link={`/places/create?candidate=${candidate.id}`}
                        noIndex={true}
                        label={t('osm-candidates_create', { defaultValue: 'Создать геометку' })}
                    />
                )}

                {candidate.breakdown.length > 0 && (
                    <details className={styles.rating}>
                        <summary>
                            <Icon
                                name={'KeyboardRight'}
                                className={styles.chevron}
                            />
                            <span className={styles.ratingLabel}>
                                {t('osm-candidates_rating-label', { defaultValue: 'Рейтинг интереса' })}
                            </span>
                            <span className={styles.ratingValue}>{candidate.score}</span>
                        </summary>
                        <ul>
                            {candidate.breakdown.map((item, index) => (
                                <li key={`${item.code}${index}`}>
                                    <span>{breakdownText(t, item, candidate)}</span>
                                    <span
                                        className={cn(
                                            styles.points,
                                            item.points > 0 && styles.positive,
                                            item.points < 0 && styles.negative
                                        )}
                                    >
                                        {formatPoints(item.points)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </details>
                )}

                {sources.length > 0 && (
                    <footer className={styles.sources}>
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
                    </footer>
                )}

                {isAdmin && (
                    <Button
                        stretched={true}
                        mode={'outline'}
                        variant={'negative'}
                        size={'medium'}
                        loading={pending === 'reject'}
                        disabled={!!pending}
                        label={t('osm-candidates_reject', { defaultValue: 'Скрыть навсегда' })}
                        onClick={() => setConfirmReject(true)}
                    />
                )}
            </div>

            {isAdmin && (
                <ConfirmationDialog
                    open={confirmReject}
                    message={t('osm-candidates_reject-confirm', {
                        defaultValue: 'Скрыть «{{title}}» с карты навсегда? Повторный сбор данных его не вернёт.',
                        title
                    })}
                    confirmLabel={t('osm-candidates_reject-action', { defaultValue: 'Скрыть' })}
                    onCancel={() => setConfirmReject(false)}
                    onConfirm={handleReject}
                />
            )}
        </article>
    )
}
