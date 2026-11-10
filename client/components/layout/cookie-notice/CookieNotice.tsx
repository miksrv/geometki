import React from 'react'
import { Button } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { FloatingPrompt } from '@/components/ui'
import { useCookieConsent } from '@/hooks/useCookieConsent'

/**
 * The notice that the site uses cookies and counts visits (Yandex Metrica, Google Analytics),
 * to every visitor until they close it on this browser. The first of the floating prompts:
 * the push offer waits for it. Not shown before the browser knows (no flash on a cached page).
 */
export const CookieNotice: React.FC = () => {
    const { t } = useTranslation()
    const { accepted, accept } = useCookieConsent()

    if (accepted !== false) {
        return null
    }

    return (
        <FloatingPrompt
            label={t('cookie-notice-label')}
            text={t('cookie-notice-text')}
            actions={
                <Button
                    size={'medium'}
                    mode={'primary'}
                    label={t('cookie-notice-accept')}
                    onClick={accept}
                />
            }
        />
    )
}
