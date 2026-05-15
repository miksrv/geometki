import React from 'react'
import { cn } from 'simple-react-ui-kit'

import styles from './styles.module.sass'

export interface TooltipProps {
    content: React.ReactNode
    position?: 'top' | 'bottom' | 'left' | 'right'
    children: React.ReactElement
    className?: string
}

export const Tooltip: React.FC<TooltipProps> = ({ content, position = 'top', children, className }) => (
    <span className={cn(styles.wrapper, className)}>
        {children}
        <span className={cn(styles.tooltip, styles[position])}>{content}</span>
    </span>
)
