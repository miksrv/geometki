import React from 'react'
import { Icon } from 'simple-react-ui-kit'

import Image from 'next/image'

import { ApiModel } from '@/api'
import { IMG_HOST } from '@/config/env'
import { levelImage } from '@/functions/userLevels'

import styles from './styles.module.sass'

export const NotificationIcon: React.FC<ApiModel.Notification> = ({ ...props }): React.ReactNode =>
    props.type === 'experience' ? (
        <Icon name={'DoubleUp'} />
    ) : props.type === 'error' ? (
        <Icon name={'ReportError'} />
    ) : props.type === 'success' ? (
        <Icon name={'CheckCircle'} />
    ) : props.type === 'level' ? (
        <Image
            src={levelImage(props.meta?.level).src}
            alt={''}
            width={26}
            height={26}
        />
    ) : props.place ? (
        <Image
            className={styles.placeImage}
            src={`${IMG_HOST}${props.place.cover?.preview}`}
            alt={''}
            width={50}
            height={42}
            style={{
                height: '100%',
                objectFit: 'cover'
            }}
        />
    ) : (
        <></>
    )
