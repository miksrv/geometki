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
                    {places.map((place) => (
                        <PlaceCard
                            key={place.id}
                            place={place}
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
