import React, { useEffect, useState } from 'react'
import { Button, cn, Container, Icon } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiType } from '@/api'
import { OSM_CANDIDATES_POLLING_MS } from '@/components/map/osm-candidates/constants'
import { collectionPickerStyles } from '@/components/shared'
import useUserLocation from '@/hooks/useUserLocation'
import { formatThousands } from '@/utils/helpers'

import styles from './styles.module.sass'

/** Half the side of the box around the visitor, degrees: about 30 km north to south */
const AREA_LAT = 0.25
const AREA_LON = 0.4
const LIST_LIMIT = 4

const squaredDistance = (a: ApiType.Coordinates, lat: number, lon: number): number =>
    (a.lat - lat) ** 2 + ((a.lon - lon) * Math.cos((a.lat * Math.PI) / 180)) ** 2

interface HomeUnexploredProps {
    /** All open candidates of the site (`GET /stats`), for the line shown before the location is known */
    total?: number
}

/**
 * "Ждут исследования": interesting OpenStreetMap objects near the user that are not on
 * Geometki yet (the map's "new interesting places" layer), each a link to the map there.
 * Without a known location it is one line and a button that asks for it.
 */
export const HomeUnexplored: React.FC<HomeUnexploredProps> = ({ total }) => {
    const { t } = useTranslation()
    const { location: storedLocation, loading: locating, request: requestLocation } = useUserLocation()

    // The location lives in a cookie the server render does not read here: use it after
    // hydration, so the server and the first client render agree
    const [mounted, setMounted] = useState<boolean>(false)
    useEffect(() => setMounted(true), [])
    const location = mounted ? storedLocation : undefined

    // A new area is collected in the background: poll until its tiles are done, as the map does
    const [pollingInterval, setPollingInterval] = useState<number>(0)

    const { data, isFetching } = API.useOsmCandidatesGetListQuery(
        {
            bounds: location
                ? [
                      location.lat - AREA_LAT,
                      location.lon - AREA_LON,
                      location.lat + AREA_LAT,
                      location.lon + AREA_LON
                  ].join(',')
                : ''
        },
        { pollingInterval, skip: !location, skipPollingIfUnfocused: true }
    )

    const pending = !!data?.pendingTiles

    useEffect(() => {
        setPollingInterval(pending ? OSM_CANDIDATES_POLLING_MS : 0)
    }, [pending])

    const candidates = location
        ? [...(data?.items ?? [])]
              // An admin also gets the candidates already linked to a place
              .filter((candidate) => candidate.status === 'open')
              .sort((a, b) => squaredDistance(location, a.lat, a.lon) - squaredDistance(location, b.lat, b.lon))
              .slice(0, LIST_LIMIT)
        : []

    const mapLink = location ? `/map#${location.lat},${location.lon},11` : '/map'

    return (
        <Container
            title={t('home-unexplored-title')}
            action={
                <Link
                    href={mapLink}
                    title={t('home-unexplored-map')}
                >
                    {t('home-unexplored-map')}
                </Link>
            }
        >
            {!location ? (
                <div className={styles.locate}>
                    <p>
                        {total
                            ? t('home-unexplored-hint', { count: total, value: formatThousands(total) })
                            : t('home-unexplored-hint-generic')}
                    </p>
                    <Button
                        mode={'secondary'}
                        size={'medium'}
                        icon={'Position'}
                        loading={locating}
                        label={t('home-unexplored-button')}
                        onClick={() => void requestLocation()}
                    />
                </div>
            ) : !candidates.length ? (
                <p className={styles.empty}>
                    {isFetching || pending ? t('home-unexplored-loading') : t('home-unexplored-empty')}
                </p>
            ) : (
                <ul className={styles.rows}>
                    {candidates.map((candidate) => {
                        const cover = candidate.photos[0]?.url ?? candidate.image
                        const title = candidate.name ?? candidate.typeTitle

                        return (
                            <li key={candidate.id}>
                                <Link
                                    href={`/map#${candidate.lat},${candidate.lon},15`}
                                    className={cn(collectionPickerStyles.pickerRow, styles.row)}
                                    title={title}
                                >
                                    <span className={collectionPickerStyles.pickerCover}>
                                        {cover ? (
                                            // Commons and OSM photos: any host, so not next/image
                                            // eslint-disable-next-line next/no-img-element
                                            <img
                                                src={cover}
                                                alt={''}
                                                loading={'lazy'}
                                            />
                                        ) : (
                                            <Icon name={'Compass'} />
                                        )}
                                    </span>
                                    <span className={collectionPickerStyles.pickerBody}>
                                        <strong>{title}</strong>
                                        <span>
                                            {[candidate.name ? candidate.typeTitle : null, candidate.settlement?.name]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </span>
                                    </span>
                                </Link>
                            </li>
                        )
                    })}
                </ul>
            )}
        </Container>
    )
}
