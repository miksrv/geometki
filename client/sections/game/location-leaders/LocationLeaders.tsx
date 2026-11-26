import React from 'react'
import { Container } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTranslation } from 'next-i18next/pages'

import { API, ApiType } from '@/api'
import { GameLeaders } from '@/components/shared'
import { GAME_HREF } from '@/utils/game'

import styles from './styles.module.sass'

/** The leaders of a location on its page: the top of the season there, the rest is on the game page */
const LIMIT = 5

interface LocationLeadersProps {
    type: ApiType.LocationTypes
    id: number
    /** The location's name, for the block's title */
    title?: string
}

/**
 * "Лидеры сезона" of a location, on the page of its places: who has the most season points for
 * the places of this region, district or town. Asked in the
 * browser (the location pages are for everyone), and nothing while nobody has played there
 * this season.
 */
export const LocationLeaders: React.FC<LocationLeadersProps> = ({ type, id, title }) => {
    const { t } = useTranslation()
    const { data } = API.useGameGetLeadersQuery({ id, limit: LIMIT, type }, { skip: !id })

    if (!data?.count) {
        return null
    }

    return (
        <Container
            title={title ? t('game-location-leaders-of', { location: title }) : t('game-location-leaders')}
            action={<Link href={GAME_HREF}>{t('game-leaders-all')}</Link>}
        >
            <GameLeaders
                location={{ id, type }}
                initial={data}
                limit={LIMIT}
                className={styles.leaders}
            />
        </Container>
    )
}
