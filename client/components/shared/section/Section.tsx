import React, { useId } from 'react'
import { cn } from 'simple-react-ui-kit'

import styles from './styles.module.sass'

export interface SectionProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
    /** Heading of the section; a count or a node is fine ("Фото (17)") */
    title?: React.ReactNode
    /** Heading level: 2 for the main column (18px), 3 inside a sidebar (16px) */
    level?: 2 | 3
    /** Controls on the heading line, right-aligned: `mode="link"` buttons */
    action?: React.ReactNode
    /** Secondary text under the content */
    footer?: React.ReactNode
    /** Keep the heading and the action on one line, cutting a long title with an ellipsis */
    truncateTitle?: boolean
    className?: string
    children?: React.ReactNode
}

/**
 * A titled part of an entity page on the page background: heading + optional actions,
 * the content, an optional footer — and no box. Same slots as the kit `Container`, so a
 * block moves between the two by swapping the import (DESIGN.md → "Sections, not
 * containers"). Candidate for `simple-react-ui-kit`; lives here until the kit ships it.
 */
export const Section: React.FC<SectionProps> = ({
    title,
    level = 2,
    action,
    footer,
    truncateTitle,
    className,
    children,
    ...props
}) => {
    const generatedId = useId()
    const titleId = `${generatedId}-title`
    const Heading: 'h2' | 'h3' = level === 3 ? 'h3' : 'h2'

    return (
        <section
            {...props}
            className={cn(styles.section, level === 3 && styles.compact, className)}
            aria-labelledby={title ? titleId : props['aria-labelledby']}
        >
            {(title || action) && (
                <div className={cn(styles.header, truncateTitle && styles.truncate)}>
                    {title && (
                        <Heading
                            id={titleId}
                            className={styles.title}
                        >
                            {title}
                        </Heading>
                    )}
                    {action && <div className={styles.actions}>{action}</div>}
                </div>
            )}
            {children}
            {footer && <div className={styles.footer}>{footer}</div>}
        </section>
    )
}
