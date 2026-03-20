import React, { useEffect, useRef, useState } from 'react'
import { Button, Checkbox, cn, Container } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next'

import { RadioButton } from '@/components/ui'

import { MapAdditionalLayersEnum, MapLayersEnum, MapObjectsTypeEnum } from '../types'

import styles from '../styles.module.sass'

interface LayerSwitcherControlProps {
    currentLayer?: MapLayersEnum
    currentType?: MapObjectsTypeEnum
    hideAdditionalLayers?: boolean
    additionalLayers?: MapAdditionalLayersEnum[]
    onSwitchMapLayer?: (layer: MapLayersEnum) => void
    onSwitchMapType?: (type: MapObjectsTypeEnum) => void
    onSwitchAdditionalLayers?: (layer?: MapAdditionalLayersEnum[]) => void
}

export const LayerSwitcherControl: React.FC<LayerSwitcherControlProps> = ({
    currentLayer,
    currentType,
    hideAdditionalLayers,
    additionalLayers,
    onSwitchMapLayer,
    onSwitchMapType,
    onSwitchAdditionalLayers
}) => {
    const { t } = useTranslation('components.interactive-map.layer-switcher-control')

    const layersContainerRef = useRef<HTMLDivElement>(null)
    const [open, setOpen] = useState<boolean>(false)

    const handleToggleOpen = () => {
        setOpen(!open)
    }

    const handleClickOutside = (event: MouseEvent) => {
        if (layersContainerRef.current && !layersContainerRef.current.contains(event.target as Node)) {
            setOpen(false)
        }
    }

    const handleSwitchMapLayer = (event: React.ChangeEvent<HTMLInputElement>) => {
        onSwitchMapLayer?.(event.target.id as MapLayersEnum)
    }

    const handleSwitchMapType = (event: React.ChangeEvent<HTMLInputElement>) => {
        onSwitchMapType?.(event.target.id as MapObjectsTypeEnum)
    }

    const titleMapLayer: Record<MapLayersEnum, string> = {
        [MapLayersEnum.GOOGLE_MAP]: t('map-layer_GoogleMap', {
            defaultValue: 'Google Карты'
        }),
        [MapLayersEnum.GOOGLE_SAT]: t('map-layer_GoogleSat', {
            defaultValue: 'Google Спутник'
        }),
        [MapLayersEnum.MAPBOX]: t('map-layer_MapBox', {
            defaultValue: 'MapBox'
        }),
        [MapLayersEnum.MAPBOX_SAT]: t('map-layer_MapBoxSat', {
            defaultValue: 'MapBox Спутник'
        }),
        [MapLayersEnum.OCM]: t('map-layer_OCM', {
            defaultValue: 'OpenCycleMap'
        }),
        [MapLayersEnum.OSM]: t('map-layer_OSM', {
            defaultValue: 'OpenStreetMap'
        })
    }

    const titleMapType: Record<MapObjectsTypeEnum, string> = {
        [MapObjectsTypeEnum.PHOTOS]: t('map-type_Photos', {
            defaultValue: 'Photos'
        }),
        [MapObjectsTypeEnum.PLACES]: t('map-type_Places', {
            defaultValue: 'Places'
        })
    }

    const titleAdditionalMapType: Record<MapAdditionalLayersEnum, string> = {
        [MapAdditionalLayersEnum.HEATMAP]: t('map-type_Heatmap', {
            defaultValue: 'Heatmap'
        }),
        [MapAdditionalLayersEnum.HISTORICAL_PHOTOS]: t('map-type_HistoricalPhotos', {
            defaultValue: 'Historical Photos'
        })
    }

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside)

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    return !open ? (
        <Button
            mode={'secondary'}
            icon={'Layers'}
            onClick={handleToggleOpen}
        />
    ) : (
        <Container
            className={styles.mapLayersContainer}
            onMouseMove={(e) => e.stopPropagation()}
            onWheelCapture={(e) => e.stopPropagation()}
        >
            <div ref={layersContainerRef}>
                <ul className={cn(styles.mapLayersList, hideAdditionalLayers && styles.noMarginBottom)}>
                    {Object.values(MapLayersEnum).map((layer) => (
                        <li key={layer}>
                            <RadioButton
                                id={layer}
                                label={titleMapLayer[layer]}
                                checked={currentLayer === layer}
                                onChange={handleSwitchMapLayer}
                            />
                        </li>
                    ))}
                </ul>

                {!hideAdditionalLayers && (
                    <ul className={styles.mapPointsTypeList}>
                        {Object.values(MapObjectsTypeEnum).map((type) => (
                            <li key={type}>
                                <RadioButton
                                    id={type}
                                    label={titleMapType[type]}
                                    checked={currentType === type}
                                    onChange={handleSwitchMapType}
                                />
                            </li>
                        ))}
                    </ul>
                )}

                {!hideAdditionalLayers && (
                    <ul className={styles.mapAdditionalList}>
                        {Object.values(MapAdditionalLayersEnum).map((type) => (
                            <li key={type}>
                                <Checkbox
                                    id={type}
                                    label={titleAdditionalMapType[type]}
                                    checked={additionalLayers?.includes(type)}
                                    onChange={() =>
                                        onSwitchAdditionalLayers?.(
                                            additionalLayers?.includes(type)
                                                ? additionalLayers.filter((layer) => layer !== type)
                                                : [...(additionalLayers || []), type]
                                        )
                                    }
                                />
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </Container>
    )
}
