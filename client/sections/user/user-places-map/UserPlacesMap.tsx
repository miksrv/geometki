import React, { useMemo, useState } from 'react'
import { Button, cn } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel } from '@/api'
import { ToneBadge } from '@/components/map/tone-badge'
import { PlacesMap } from '@/components/shared'
import { formatThousands } from '@/utils/helpers'

import styles from './styles.module.sass'

type Filter = 'all' | ApiModel.PlaceMarkTone

/** The sets in the order of the chips and of the "Места" tab */
const TONES: ApiModel.PlaceMarkTone[] = ['added', 'visited', 'bookmark']

/**
 * The marks of a place in several sets, most telling first: a place the person added and visited
 * shows the check, one they added and keep in bookmarks the bookmark; their own places alone are plain
 */
const MERGE_ORDER: ApiModel.PlaceMarkTone[] = ['visited', 'bookmark', 'added']

/** The badge of a set; the places the person added carry none */
const badgeOf = (tone: ApiModel.PlaceMarkTone): ApiModel.PlaceMarkBadge | undefined =>
    tone === 'added' ? undefined : tone

/** The set of the "Места" tab of a tone: the same words on the map and in the tab */
const TONE_SHOW: Record<ApiModel.PlaceMarkTone, string> = { added: 'added', bookmark: 'bookmarks', visited: 'visited' }

/** One mark per place, with the badge of the first set of `MERGE_ORDER` it is in */
export const mergeUserPlaces = (
    sets: Record<ApiModel.PlaceMarkTone, ApiModel.PlaceMark[] | undefined>
): ApiModel.PlaceMark[] => {
    const byId = new Map<string, ApiModel.PlaceMark>()

    for (const tone of MERGE_ORDER) {
        for (const place of sets[tone] ?? []) {
            const key = place.id ?? `${place.lat},${place.lon}`

            if (!byId.has(key)) {
                byId.set(key, { ...place, tone: badgeOf(tone) })
            }
        }
    }

    return Array.from(byId.values())
}

interface UserPlacesMapProps {
    userId: string
    /** The profile's counts: a set the person has nothing in is not asked for at all */
    statistic?: ApiModel.UserStatistic
}

/** A set is asked for unless the profile's count says it is empty (an unknown count is asked) */
const hasAny = (count?: number) => count === undefined || count > 0

/**
 * The places of a person on one map, the counterpart of the place sets in the "Места" tab:
 * those they added, visited and keep in bookmarks. The places they have been to carry a green check
 * on the marker's corner, the bookmarked ones an orange bookmark (`PlaceMark.tone`, `ToneBadge`),
 * always — with one set only too; their own places are plain markers. A place in several sets
 * takes the badge of the first of `MERGE_ORDER` (visited, bookmark, added). The set shown is
 * chosen on the map itself — a small radio group over its top-right corner ("Все 108 ·
 * Добавленные 101 · ✓ Посещённые 10", each set with the badge of its markers: the group is the
 * legend; on phones a set with a badge is the badge and the number alone); with one set only
 * there is no group. Nothing stands over the map, so it sits right under the block before it.
 * No heading: the map speaks for itself, the "Список мест" button next to the group leads to
 * the list of the set shown. Loaded in the browser
 * (the cached profile carries no marks); a set the profile's counts say is empty is not asked
 * for, and a person without places gets nothing — not even a placeholder.
 */
export const UserPlacesMap: React.FC<UserPlacesMapProps> = ({ userId, statistic }) => {
    const { t } = useTranslation()

    const [filter, setFilter] = useState<Filter>('all')

    const wanted: Record<ApiModel.PlaceMarkTone, boolean> = {
        added: hasAny(statistic?.place),
        bookmark: hasAny(statistic?.bookmarks),
        visited: hasAny(statistic?.visited)
    }

    const added = API.usePoiGetListQuery({ author: userId }, { skip: !wanted.added })
    const visited = API.usePoiGetListQuery({ visited: userId }, { skip: !wanted.visited })
    const bookmark = API.usePoiGetListQuery({ bookmarks: userId }, { skip: !wanted.bookmark })

    const sets: Record<ApiModel.PlaceMarkTone, ApiModel.PlaceMark[] | undefined> = {
        added: added.data?.items,
        bookmark: bookmark.data?.items,
        visited: visited.data?.items
    }

    const places = useMemo(() => mergeUserPlaces(sets), [added.data, visited.data, bookmark.data])

    const filled = TONES.filter((tone) => !!sets[tone]?.length)
    const several = filled.length > 1

    const shown = useMemo(() => {
        if (filter === 'all') {
            return places
        }

        // One set: its badge on every marker all the same, the map reads alike in any view
        const tone = badgeOf(filter)

        return (sets[filter] ?? []).map((place) => ({ ...place, tone }))
    }, [filter, places, added.data, visited.data, bookmark.data])

    const loading = added.isLoading || visited.isLoading || bookmark.isLoading

    if (!TONES.some((tone) => wanted[tone]) || (!loading && !places.length)) {
        return null
    }

    // The sets to choose from: all of them, then each one that has places — a radio group on the map
    const options: Array<{ key: Filter; label: string; count: number; tone?: ApiModel.PlaceMarkBadge }> = [
        { count: places.length, key: 'all', label: t('user-map-all') },
        ...filled.map((tone) => ({
            count: sets[tone]?.length ?? 0,
            key: tone,
            label: t(`user-places-${TONE_SHOW[tone]}`),
            tone: badgeOf(tone)
        }))
    ]

    // The list of the set on the map: the chosen one, or the first that has places
    const listTone = filter !== 'all' ? filter : (filled[0] ?? 'added')
    const listHref = `/users/${userId}/places${listTone === 'added' ? '' : `?show=${TONE_SHOW[listTone]}`}`

    return (
        <section aria-label={t('user-map-title')}>
            {/* Nothing over the map: the choice of the set and the way to the lists are on it, in
                its free top-right corner (the map's own controls are on the left) */}
            <div className={styles.mapBox}>
                <PlacesMap
                    places={shown}
                    loading={loading}
                    fullScreen={true}
                />

                <div className={styles.overlay}>
                    {several && (
                        <div
                            className={styles.sets}
                            role={'radiogroup'}
                            aria-label={t('user-map-title')}
                        >
                            {options.map(({ key, label, count, tone }) => (
                                <button
                                    key={key}
                                    type={'button'}
                                    role={'radio'}
                                    aria-checked={filter === key}
                                    aria-label={`${label}: ${count}`}
                                    title={label}
                                    className={cn(styles.set, filter === key && styles.setOn)}
                                    onClick={() => setFilter(key)}
                                >
                                    {tone && <ToneBadge tone={tone} />}
                                    <span className={cn(styles.setLabel, tone && styles.setLabelWide)}>{label}</span>
                                    <span className={styles.setCount}>{formatThousands(count)}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* The kit wraps a link button in an inline-block <a>: in a flex box it adds no line */}
                    <div className={styles.listButton}>
                        <Button
                            size={'small'}
                            mode={'secondary'}
                            label={t('user-map-list')}
                            link={listHref}
                        />
                    </div>
                </div>
            </div>
        </section>
    )
}
