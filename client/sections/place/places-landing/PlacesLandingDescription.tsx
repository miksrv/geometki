import React, { useState } from 'react'
import { cn, Container } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import styles from './styles.module.sass'

interface PlacesLandingDescriptionProps {
    text: string
}

/**
 * The listing's intro text (features/20-location-seo-pages.md, "Шаблон страницы →
 * Описание"): the category's own text or the location's data summary. On a phone it
 * collapses to 2–3 lines behind "Подробнее", so the place list stays on the first screen;
 * on wider screens the full text always shows.
 */
export const PlacesLandingDescription: React.FC<PlacesLandingDescriptionProps> = ({ text }) => {
    const { t } = useTranslation()
    const [expanded, setExpanded] = useState(false)

    if (!text) {
        return null
    }

    return (
        <Container className={styles.description}>
            <p className={cn(styles.text, expanded && styles.expanded)}>{text}</p>
            {!expanded && (
                <button
                    type={'button'}
                    className={styles.more}
                    onClick={() => setExpanded(true)}
                >
                    {t('landing-description-more', 'Подробнее')}
                </button>
            )}
        </Container>
    )
}
