import React, { useMemo, useState } from 'react'
import { Button } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiModel } from '@/api'
import { PlacesMap } from '@/components/shared'
import { Chip } from '@/components/ui'

import styles from './styles.module.sass'

type Filter = 'all' | ApiModel.PlaceMarkTone

/** The order of the tones: a place the person added and visited is "added" on the map */
const TONES: ApiModel.PlaceMarkTone[] = ['added', 'visited', 'bookmark']

/** The set of the "Места" tab of a tone: the same words on the map and in the tab */
const TONE_SHOW: Record<ApiModel.PlaceMarkTone, string> = { added: 'added', bookmark: 'bookmarks', visited: 'visited' }

/** One mark per place, toned by the first set of `TONES` it is in */
export const mergeUserPlaces = (
    sets: Record<ApiModel.PlaceMarkTone, ApiModel.PlaceMark[] | undefined>
): ApiModel.PlaceMark[] => {
    const byId = new Map<string, ApiModel.PlaceMark>()

    for (const tone of TONES) {
        for (const place of sets[tone] ?? []) {
            const key = place.id ?? `${place.lat},${place.lon}`

            if (!byId.has(key)) {
                byId.set(key, { ...place, tone })
            }
        }
    }

    return Array.from(byId.values())
}

interface UserPlacesMapProps {
    userId: string
}

/**
 * The places of a person on one map, the counterpart of the place sets in the "Места" tab:
 * those they added, visited and keep in bookmarks, each with a frame of its colour
 * (`PlaceMark.tone`) named in a legend under the map, and chips to show one set. A place in
 * several sets takes the first tone of `TONES`. With one set only there is nothing to tell
 * apart: plain markers, no chips, no legend. No heading: the map speaks for itself, the
 * "Список мест" button over its corner leads to the lists. Loaded in the browser (the cached profile carries
 * no marks); renders nothing for a person without places.
 */
export const UserPlacesMap: React.FC<UserPlacesMapProps> = ({ userId }) => {
    const { t } = useTranslation()

    const [filter, setFilter] = useState<Filter>('all')

    const added = API.usePoiGetListQuery({ author: userId })
    const visited = API.usePoiGetListQuery({ visited: userId })
    const bookmark = API.usePoiGetListQuery({ bookmarks: userId })

    const sets: Record<ApiModel.PlaceMarkTone, ApiModel.PlaceMark[] | undefined> = {
        added: added.data?.items,
        bookmark: bookmark.data?.items,
        visited: visited.data?.items
    }

    const places = useMemo(() => mergeUserPlaces(sets), [added.data, visited.data, bookmark.data])

    const filled = TONES.filter((tone) => !!sets[tone]?.length)
    const several = filled.length > 1

    const shown = useMemo(() => {
        if (filter !== 'all') {
            return sets[filter] ?? []
        }

        // The frames mean something only while several sets share the map
        return several ? places : places.map(({ tone: _tone, ...place }) => place)
    }, [filter, places, several])

    const loading = added.isLoading || visited.isLoading || bookmark.isLoading

    if (!loading && !places.length) {
        return null
    }

    return (
        <section aria-label={t('user-map-title')}>
            {several && (
                <div className={styles.chips}>
                    <Chip
                        size={'small'}
                        label={t('user-map-all')}
                        count={places.length || undefined}
                        selected={filter === 'all'}
                        onClick={() => setFilter('all')}
                    />
                    {TONES.map((tone) =>
                        sets[tone]?.length ? (
                            <Chip
                                key={tone}
                                size={'small'}
                                label={t(`user-places-${TONE_SHOW[tone]}`)}
                                count={sets[tone]?.length}
                                selected={filter === tone}
                                onClick={() => setFilter(tone)}
                            />
                        ) : null
                    )}
                </div>
            )}

            {/* The way to the lists is a button over the map's free top-right corner */}
            <div className={styles.mapBox}>
                <PlacesMap
                    places={shown}
                    loading={loading}
                />
                <Button
                    className={styles.listButton}
                    size={'small'}
                    mode={'secondary'}
                    label={t('user-map-list')}
                    link={`/users/${userId}/places`}
                />
            </div>

            {filter === 'all' && several && (
                <ul
                    className={styles.legend}
                    aria-label={t('user-map-legend')}
                >
                    {filled.map((tone) => (
                        <li key={tone}>
                            <span className={`${styles.swatch} ${styles[tone]}`} />
                            {t(`user-places-${TONE_SHOW[tone]}`)}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    )
}
