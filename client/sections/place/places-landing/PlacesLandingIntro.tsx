import React from 'react'

import { ApiModel } from '@/api'
import { LandingMapPreview } from '@/components/shared'

import { PlacesLandingDescription } from './PlacesLandingDescription'

import styles from './styles.module.sass'

interface PlacesLandingIntroProps {
    description: string
    /** The compact map preview — only on location and pair pages, and only on page 1 */
    showMap?: boolean
    places?: ApiModel.PlaceListItem[]
    fullMapQuery?: string
}

/**
 * Description + the lazy map preview, side by side on desktop and stacked on mobile
 * (features/20-location-seo-pages.md, "Шаблон страницы → Карта"). Category-only and
 * `/places` pages pass `showMap={false}` — places are scattered nationwide there, a
 * preview would not mean anything.
 */
export const PlacesLandingIntro: React.FC<PlacesLandingIntroProps> = ({
    description,
    showMap,
    places,
    fullMapQuery
}) => {
    if (!description && !showMap) {
        return null
    }

    return (
        <div className={styles.intro}>
            <PlacesLandingDescription text={description} />
            {showMap && (
                <div className={styles.introMap}>
                    <LandingMapPreview
                        places={places}
                        fullMapQuery={fullMapQuery}
                    />
                </div>
            )}
        </div>
    )
}
