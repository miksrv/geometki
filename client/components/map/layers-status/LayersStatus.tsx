import React from 'react'
import { cn, Spinner } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { LayerStatus } from '../MapControlsContext'
import { MapAdditionalLayersEnum } from '../types'

import styles from './styles.module.sass'

/** The layers loaded from external sources by the visible area, in the panel's order */
export const STATUS_LAYERS = [
    MapAdditionalLayersEnum.HISTORICAL_PHOTOS,
    MapAdditionalLayersEnum.WIKIMEDIA_COMMONS,
    MapAdditionalLayersEnum.WIKIPEDIA
]

interface LayersStatusProps {
    layers?: MapAdditionalLayersEnum[]
    statuses: Partial<Record<MapAdditionalLayersEnum, LayerStatus>>
    className?: string
}

/**
 * Shows for every turned on external layer whether it is still loading and how many objects
 * it has in the visible area: an empty area is told apart from a slow source.
 */
export const LayersStatus: React.FC<LayersStatusProps> = ({ layers, statuses, className }) => {
    const { t } = useTranslation()

    const enabled = STATUS_LAYERS.filter((layer) => layers?.includes(layer))

    if (!enabled.length) {
        return null
    }

    const titles: Record<string, string> = {
        [MapAdditionalLayersEnum.HISTORICAL_PHOTOS]: t('map-type_HistoricalPhotos', {
            defaultValue: 'Исторические фото'
        }),
        [MapAdditionalLayersEnum.WIKIMEDIA_COMMONS]: t('map-type_WikimediaCommons', {
            defaultValue: 'Фото Wikimedia'
        }),
        [MapAdditionalLayersEnum.WIKIPEDIA]: t('map-type_Wikipedia', { defaultValue: 'Википедия' })
    }

    const renderValue = (status?: LayerStatus) => {
        // Not reported yet: the layer has just been turned on and is about to ask for the area
        if (!status || status.loading) {
            return (
                <Spinner
                    className={styles.spinner}
                    aria-label={t('layers-status_loading', { defaultValue: 'Загрузка' })}
                />
            )
        }

        if (status.error) {
            return <span className={styles.error}>{t('layers-status_error', { defaultValue: 'Ошибка загрузки' })}</span>
        }

        if (!status.count) {
            return <span className={styles.empty}>{'—'}</span>
        }

        if (status.limited) {
            return (
                <span title={t('layers-status_limit', { defaultValue: 'Показаны не все, приблизьте карту' })}>
                    {`${status.count}+`}
                </span>
            )
        }

        return <span>{status.count}</span>
    }

    return (
        <div className={cn(styles.wrapper, className)}>
            <div
                className={styles.panel}
                role={'status'}
            >
                {enabled.map((layer) => (
                    <div
                        key={layer}
                        className={styles.row}
                    >
                        <span className={styles.title}>{titles[layer]}</span>
                        <span className={styles.value}>{renderValue(statuses[layer])}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
