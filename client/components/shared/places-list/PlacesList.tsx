import React from 'react'
import { Container } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { MediaTileGrid } from '@/components/shared/media-tile'
import { PlaceCard, PlaceCardLoader } from '@/components/shared/place-card'

interface PlacesListProps {
    places?: ApiModel.Place[]
    loading?: boolean
}

/** Grid of place tiles with a loading state and an empty message */
export const PlacesList: React.FC<PlacesListProps> = ({ places, loading }) => {
    const { t } = useTranslation()

    return (
        <>
            {!!places?.length && (
                <MediaTileGrid>
                    {places.map((place, index) => (
                        <PlaceCard
                            key={place.id}
                            place={place}
                            // Only the first tile is in the first screen everywhere; on phones the
                            // list is one column and tiles 2 and 3 would preload for nothing
                            priority={index === 0}
                        />
                    ))}
                </MediaTileGrid>
            )}

            {loading && (
                <MediaTileGrid>
                    {Array(3)
                        .fill('')
                        .map((_, i) => (
                            <PlaceCardLoader key={i} />
                        ))}
                </MediaTileGrid>
            )}

            {!places?.length && !loading && <Container className={'emptyList'}>{t('nothing-here-yet')}</Container>}
        </>
    )
}
