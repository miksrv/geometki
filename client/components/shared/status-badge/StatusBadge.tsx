import React from 'react'
import { Badge, cn } from 'simple-react-ui-kit'

import styles from './styles.module.sass'

export type StatusTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral'

export interface StatusBadgeProps {
    label: string
    /** What the status means: green done, blue under way, orange needs a look, red failed, grey plain */
    tone?: StatusTone
    size?: 'small' | 'medium'
    className?: string
}

/**
 * The status pill of an admin table or card: the kit `Badge` in one of five tones, drawn from
 * the theme tokens. The domain keeps its own status → tone map (`tones.ts`).
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ label, tone = 'neutral', size = 'small', className }) => (
    <Badge
        size={size}
        label={label}
        className={cn(styles.statusBadge, styles[tone], className)}
    />
)
