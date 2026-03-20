import React from 'react'
import { Button } from 'simple-react-ui-kit'

import { useTheme } from 'next-themes'

import useClientOnly from '@/hooks/useClientOnly'

import styles from './styles.module.sass'

export const ThemeSwitcher: React.FC = () => {
    const isClient = useClientOnly()
    const { theme, setTheme } = useTheme()

    const handleToggleTheme = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark')
    }

    return isClient ? (
        <Button
            className={styles.themeSwitchButton}
            icon={theme === 'dark' ? 'Sun' : 'Moon'}
            mode={'outline'}
            onClick={handleToggleTheme}
        />
    ) : null
}
