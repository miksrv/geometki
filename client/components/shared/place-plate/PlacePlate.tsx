import React from 'react'
import { Icon, IconTypes, TooltipProp } from 'simple-react-ui-kit'

import styles from './styles.module.sass'

export interface PlacePlateProps {
    icon?: IconTypes
    tooltip?: TooltipProp
    children?: React.ReactNode
    content?: React.ReactNode
}

export const PlacePlate: React.FC<PlacePlateProps> = ({ icon, tooltip, children, content }) => (
    <div className={styles.placePlate}>
        {icon && (
            <Icon
                name={icon}
                tooltip={tooltip}
            />
        )}
        {children || content}
    </div>
)
