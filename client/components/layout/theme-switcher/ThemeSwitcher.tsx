import React from 'react'
import { Button } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'
import { useTheme } from 'next-themes'

import useClientOnly from '@/hooks/useClientOnly'

import styles from './styles.module.sass'

export const ThemeSwitcher: React.FC = () => {
    const { t } = useTranslation()
    const isClient = useClientOnly()
    const { theme, setTheme } = useTheme()

    const handleToggleTheme = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark')
    }

    return isClient ? (
        <Button
            unstyled
            className={styles.themeSwitchButton}
            icon={theme === 'dark' ? 'Sun' : 'Moon'}
            tooltip={
                theme === 'dark'
                    ? t('theme-switch-to-light', { defaultValue: 'Светлая тема' })
                    : t('theme-switch-to-dark', { defaultValue: 'Тёмная тема' })
            }
            onClick={handleToggleTheme}
        />
    ) : null
}
