import React from 'react'
import { cn } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTheme } from 'next-themes'

import styles from './styles.module.sass'

export const Logo: React.FC = () => {
    const { theme } = useTheme()

    return (
        <Link
            href={'/'}
            title={'Geometki'}
            className={cn(styles.logo, theme === 'dark' && styles.dark)}
        />
    )
}
