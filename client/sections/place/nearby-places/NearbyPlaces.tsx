import React from 'react'
import { Button } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'
import { PlaceCard, Section } from '@/components/shared'
import { Carousel } from '@/components/ui'

import styles from './styles.module.sass'

interface NearbyPlacesProps {
    places?: ApiModel.PlaceListItem[] | null
    lat?: number
    lon?: number
}

/** "Рядом": the closest places as a carousel of tiles with their distance, right after the description */
export const NearbyPlaces: React.FC<NearbyPlacesProps> = ({ places, lat, lon }) => {
    const { t } = useTranslation()

    if (!places?.length) {
        return null
    }

    return (
        <Section
            className={styles.section}
            title={t('nearby-places-title', { defaultValue: 'Рядом' })}
            action={
                <Button
                    mode={'link'}
                    noIndex={true}
                    link={`/places?lat=${lat}&lon=${lon}&sort=distance&order=ASC`}
                    label={t('all-places-nearby')}
                />
            }
        >
            <Carousel options={{ dragFree: true, loop: places.length > 3 }}>
                {places.map((place) => (
                    <PlaceCard
                        key={place.id}
                        place={place}
                        headingLevel={3}
                        sizes={'(max-width: 768px) 100vw, 300px'}
                    />
                ))}
            </Carousel>
        </Section>
    )
}
