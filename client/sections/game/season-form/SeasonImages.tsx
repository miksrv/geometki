import React from 'react'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiType } from '@/api'
import { ImageSlot } from '@/components/shared'
import { FieldHint } from '@/components/ui'
import { SeasonMedal } from '@/sections/game/season-medals'

import styles from './styles.module.sass'

// The picture of the season first (the medal of every participant), then its variants for the places 1–3
const KINDS: ApiType.Game.SeasonImageKind[] = ['participant', 'gold', 'silver', 'bronze']

interface SeasonImagesProps {
    season: ApiType.Game.SeasonAdmin
}

/**
 * The pictures of a season in its form: one picture — the medal every participant gets, shown as
 * the season's picture everywhere — and its variants for the places 1–3, an `ImageSlot` each
 * (the drawn badge while there is none). PNG or SVG up to 1 MB; each change is saved at once, apart
 * from the form's texts and dates.
 */
export const SeasonImages: React.FC<SeasonImagesProps> = ({ season }) => {
    const { t } = useTranslation()

    const [upload] = API.useGamePostSeasonImageMutation()
    const [remove] = API.useGameDeleteSeasonImageMutation()

    return (
        <div className={styles.images}>
            <FieldHint id={'season-images-hint'}>{t('game-season-form-images-hint')}</FieldHint>

            <ul
                className={styles.slots}
                aria-describedby={'season-images-hint'}
            >
                {KINDS.map((kind) => {
                    const image = season.medals[kind]

                    return (
                        <ImageSlot
                            key={kind}
                            id={`season-${kind}`}
                            label={t(`game-season-form-image-${kind}`)}
                            hasImage={!!image}
                            preview={
                                <SeasonMedal
                                    kind={kind}
                                    image={image}
                                    size={64}
                                />
                            }
                            onUpload={(file) => upload({ file, id: season.id, kind }).unwrap()}
                            onRemove={() => remove({ id: season.id, kind }).unwrap()}
                        />
                    )
                })}
            </ul>
        </div>
    )
}
