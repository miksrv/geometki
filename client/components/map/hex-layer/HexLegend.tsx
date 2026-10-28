import React from 'react'
import { cn } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { useAppSelector } from '@/app/store'

import { HEX_EDGE_COLOR, HEX_PLACE_COLOR, HEX_SPOT_COLOR, HEX_VISITED_COLOR } from './constants'

import styles from './styles.module.sass'

interface HexLegendProps {
    className?: string
}

/** A small hexagon of the layer's colour: the white one has the cell's edge */
const Swatch: React.FC<{ color: string }> = ({ color }) => (
    <svg
        className={styles.swatch}
        viewBox={'0 0 14 16'}
        aria-hidden={true}
    >
        <polygon
            points={'7,1 13,4.5 13,11.5 7,15 1,11.5 1,4.5'}
            fill={color}
            stroke={color === HEX_SPOT_COLOR ? HEX_EDGE_COLOR : color}
            strokeDasharray={color === HEX_SPOT_COLOR ? '2 1.5' : undefined}
        />
    </svg>
)

/**
 * What the colours of the hexagons mean, one row under the map's bottom-left corner while the
 * hexagons are shown. "You've been" is for a signed-in visitor only: a guest has no visits
 */
export const HexLegend: React.FC<HexLegendProps> = ({ className }) => {
    const { t } = useTranslation()
    const signedIn = useAppSelector((state) => !!state.auth.user?.id)

    const items = [
        signedIn && { color: HEX_VISITED_COLOR, title: t('hex_legend_visited', { defaultValue: 'Вы были' }) },
        { color: HEX_PLACE_COLOR, title: t('hex_legend_places', { defaultValue: 'На карте' }) },
        { color: HEX_SPOT_COLOR, title: t('hex_legend_spots', { defaultValue: 'Не добавлено' }) }
    ].filter((item): item is { color: string; title: string } => !!item)

    return (
        <ul className={cn(styles.legend, className)}>
            {items.map((item) => (
                <li key={item.color}>
                    <Swatch color={item.color} />
                    {item.title}
                </li>
            ))}
        </ul>
    )
}
