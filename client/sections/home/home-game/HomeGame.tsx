import React, { useEffect, useState } from 'react'

import { useTranslation } from 'next-i18next/pages'

import { API } from '@/api'
import useUserLocation from '@/hooks/useUserLocation'
import { GameSeason } from '@/sections/game/game-season'
import { GAME_HELP_HREF, GAME_HREF, VISITS_FEED_HREF } from '@/utils/game'

/**
 * The game on the signed-in home page, on the full width under the welcome card (and what the
 * person is in the middle of — a quest, the first steps): the
 * main thing of the site, what a person comes back for. It is the season card of the game
 * page itself (`GameSeason variant="home"`, as the welcome card is the profile's one) — the
 * season's picture | "Игровой сезон продолжается", its name, the bar of its time and two plain
 * links, "Рейтинги сезона · События · Как играть" (no taller than the picture) | the visitor's geopoints
 * and place — and under it: two lines of the table, the player above and the visitor's own
 * (someone who has not played stands under the last player) | the one
 * place worth going to now (when the visitor's location is known, never asked for here: the most
 * valuable one within `NEXT_RADIUS` km, or the nearest one when there is none).
 */
/** How far the next place may be, km: a place one can get to on a day */
const NEXT_RADIUS = 20

export const HomeGame: React.FC = () => {
    const { t } = useTranslation()
    // With the player above: the block shows the visitor's line next to theirs
    const { data } = API.useGameGetQuery({ rivals: true })
    const { location: storedLocation } = useUserLocation()

    // The location is in a cookie: used after hydration, so the server and the first client render agree
    const [mounted, setMounted] = useState<boolean>(false)
    useEffect(() => setMounted(true), [])
    const location = mounted ? storedLocation : undefined

    const current = !!data?.season?.current

    const { data: places } = API.useGameGetPlacesQuery(
        { lat: location?.lat, limit: 1, lon: location?.lon, radius: location ? NEXT_RADIUS : undefined },
        { skip: !current || !mounted }
    )

    // Between seasons there is nothing to show
    if (!data?.season || !current) {
        return null
    }

    return (
        <GameSeason
            variant={'home'}
            season={data.season}
            me={data.me}
            totals={data.totals}
            next={places?.items[0]}
            links={[
                { href: GAME_HREF, label: t('home-game-rating') },
                { href: VISITS_FEED_HREF, label: t('game-season-events') },
                { href: GAME_HELP_HREF, label: t('game-rules-title') }
            ]}
        />
    )
}
