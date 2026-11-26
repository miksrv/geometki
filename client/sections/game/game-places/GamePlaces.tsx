import React, { useEffect, useState } from 'react'
import { Button } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiType } from '@/api'
import { GamePoints, PlaceCard, PlaceCardLoader, Section } from '@/components/shared'
import { Tabs } from '@/components/ui'
import useUserLocation from '@/hooks/useUserLocation'

import styles from './styles.module.sass'

type PlacesTab = 'nearby' | 'everywhere'

/** One row of tiles on the full width */
export const GAME_PLACES_LIMIT = 4

interface GamePlacesProps {
    /** The server render's list: the places nearest to the visitor's point, or of the whole map without it */
    initial?: ApiType.Game.PlacesResponse | null
    /** Which of the two the server render is */
    initialNearby?: boolean
}

/**
 * "Ценные геометки": a hint where to go — four places the visitor has not explored this
 * season, the most geopoints first, near them (asks the browser for the location on the button
 * only) or on the whole map. One row of the usual place tiles on the full width (two by two on
 * phones) with what a check-in gives now over the cover.
 */
export const GamePlaces: React.FC<GamePlacesProps> = ({ initial, initialNearby }) => {
    const { t } = useTranslation()
    const { location: storedLocation, loading: locating, request: requestLocation } = useUserLocation()

    // The location is in a cookie: used after hydration, so the server and the first client render agree
    const [mounted, setMounted] = useState<boolean>(false)
    useEffect(() => setMounted(true), [])
    const location = mounted ? storedLocation : undefined

    const [tab, setTab] = useState<PlacesTab>(initialNearby ? 'nearby' : 'everywhere')

    const tabs: Array<{ key: PlacesTab; label: string }> = [
        { key: 'nearby', label: t('game-places-tab-nearby') },
        { key: 'everywhere', label: t('game-places-tab-everywhere') }
    ]

    // The server render answers its own tab; the other one is asked on a tap
    const fromServer = !!initial && tab === (initialNearby ? 'nearby' : 'everywhere')

    const { data, isFetching } = API.useGameGetPlacesQuery(
        tab === 'nearby'
            ? { lat: location?.lat, limit: GAME_PLACES_LIMIT, lon: location?.lon }
            : { limit: GAME_PLACES_LIMIT },
        { skip: fromServer || (tab === 'nearby' && !location) }
    )

    const places = fromServer ? initial?.items : data?.items
    const needsLocation = tab === 'nearby' && !location && !fromServer

    return (
        <Section title={t('game-places-title')}>
            <Tabs<PlacesTab>
                className={styles.tabs}
                aria-label={t('game-places-title')}
                activeTab={tab}
                tabs={tabs}
                onChangeTab={(key) => key && setTab(key)}
            />

            {needsLocation ? (
                <div className={styles.locate}>
                    <p>{t('game-places-nearby-hint')}</p>
                    <Button
                        mode={'primary'}
                        size={'medium'}
                        icon={'Position'}
                        loading={locating}
                        label={t('game-places-nearby-button')}
                        onClick={() => void requestLocation()}
                    />
                </div>
            ) : !places && isFetching ? (
                <div className={styles.loaders}>
                    {[0, 1, 2, 3].map((i) => (
                        <PlaceCardLoader key={i} />
                    ))}
                </div>
            ) : places?.length ? (
                <div className={styles.grid}>
                    {places.map((place) => (
                        <PlaceCard
                            key={place.id}
                            place={place}
                            headingLevel={3}
                            sizes={'(max-width: 768px) 50vw, 25vw'}
                            badge={
                                <GamePoints
                                    value={place.game.points}
                                    plus={true}
                                    variant={'cover'}
                                    label={t('game-points-for-visit', { count: place.game.points })}
                                />
                            }
                        />
                    ))}
                </div>
            ) : (
                <p className={styles.empty}>{t('game-places-empty')}</p>
            )}
        </Section>
    )
}
