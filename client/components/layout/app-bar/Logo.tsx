import React from 'react'

import Link from 'next/link'

import styles from './styles.module.sass'

export const Logo: React.FC = () => (
    <Link
        href={'/'}
        title={'Geometki'}
        aria-label={'Geometki'}
        className={styles.logo}
    >
        <span className={styles.logoMark} />
    </Link>
)
