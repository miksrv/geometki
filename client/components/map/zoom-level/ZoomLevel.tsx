import React, { useEffect } from 'react'
import { useMap } from 'react-leaflet'

import styles from './styles.module.sass'

/**
 * The current zoom between the "+" and "−" buttons of the Leaflet zoom control, like on nakarte.me.
 * The control is Leaflet's own DOM, so the level is put into it, not rendered by React.
 */
export const ZoomLevel: React.FC = () => {
    const map = useMap()

    useEffect(() => {
        const zoomIn = map.zoomControl?.getContainer()?.querySelector('.leaflet-control-zoom-in')

        if (!zoomIn) {
            return
        }

        const level = document.createElement('div')
        level.className = styles.zoomLevel
        zoomIn.after(level)

        const update = () => {
            level.textContent = String(Math.round(map.getZoom()))
        }

        update()
        map.on('zoomend', update)

        return () => {
            map.off('zoomend', update)
            level.remove()
        }
    }, [map])

    return null
}
