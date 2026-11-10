import React, { useEffect, useId } from 'react'
import { cn } from 'simple-react-ui-kit'

import styles from './styles.module.sass'

export interface FloatingPromptProps {
    /** The heading; without it the card is named by `label` */
    title?: string
    /** The accessible name of a card without a title */
    label?: string
    text: React.ReactNode
    /** The buttons: the main one first */
    actions?: React.ReactNode
    /** Escape closes the card this way (put it off); none — Escape does nothing */
    onEscape?: () => void
    className?: string
}

/**
 * A card the site floats over the page to ask or tell one thing (DESIGN.md → Patterns →
 * Floating prompt): the push offer, the cookie notice. Bottom right on desktop, clear of the
 * toasts (bottom left); on phones at the top under the app bar, clear of the toasts and the
 * bottom navigation. One at a time: the callers take turns.
 */
export const FloatingPrompt: React.FC<FloatingPromptProps> = ({ title, label, text, actions, onEscape, className }) => {
    const id = useId()
    const titleId = `${id}-title`
    const textId = `${id}-text`

    useEffect(() => {
        if (!onEscape) {
            return
        }

        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onEscape()
            }
        }

        window.addEventListener('keydown', onKey)

        return () => window.removeEventListener('keydown', onKey)
    }, [onEscape])

    return (
        <section
            className={cn(styles.floatingPrompt, className)}
            role={'region'}
            aria-labelledby={title ? titleId : undefined}
            aria-label={title ? undefined : label}
            aria-describedby={textId}
        >
            {title && (
                <h2
                    id={titleId}
                    className={styles.title}
                >
                    {title}
                </h2>
            )}
            <p
                id={textId}
                className={cn(styles.text, !title && styles.alone)}
            >
                {text}
            </p>
            {actions && <div className={styles.actions}>{actions}</div>}
        </section>
    )
}
