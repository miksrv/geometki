import React from 'react'
import { Icon } from 'simple-react-ui-kit'

import Image from 'next/image'

import { ApiModel } from '@/api'
import { AchievementIcon } from '@/components/shared/achievement-icon'
import { LevelBadge } from '@/components/shared/level-badge/LevelBadge'
import { IMG_HOST } from '@/config/env'

import styles from './styles.module.sass'

export const NotificationIcon: React.FC<ApiModel.Notification> = ({ ...props }): React.ReactNode =>
    props.type === 'experience' ? (
        <Icon name={'DoubleUp'} />
    ) : props.type === 'error' ? (
        <Icon name={'ReportError'} />
    ) : props.type === 'success' ? (
        <Icon name={'CheckCircle'} />
    ) : props.type === 'level' ? (
        <LevelBadge
            level={props.meta?.level}
            size={26}
        />
    ) : props.type === 'achievements' ? (
        <AchievementIcon
            image={props.meta?.image}
            alt={props.meta?.title ?? ''}
            size={26}
        />
    ) : props.place?.cover?.preview ? (
        <Image
            className={styles.placeImage}
            src={`${IMG_HOST}${props.place.cover.preview}`}
            alt={''}
            // The square slot of the icon sets the size (styles.module.sass); 2x for sharp retina previews
            width={80}
            height={80}
        />
    ) : props.place ? (
        // A place without a cover: the place pin instead of a broken image
        <Icon name={'Point'} />
    ) : (
        <></>
    )
