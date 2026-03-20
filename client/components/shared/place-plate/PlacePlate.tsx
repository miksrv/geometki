import React from 'react'
import { Icon, IconTypes } from 'simple-react-ui-kit'

import styles from './styles.module.sass'

export interface PlacePlateProps {
    icon?: IconTypes
    children?: React.ReactNode
    content?: React.ReactNode
}

export const PlacePlate: React.FC<PlacePlateProps> = ({ icon, children, content }) => (
    <div className={styles.placePlate}>
        {icon && <Icon name={icon} />}
        {children || content}
    </div>
)
