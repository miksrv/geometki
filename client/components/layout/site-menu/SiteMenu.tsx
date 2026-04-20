import React from 'react'
import { Icon, IconTypes } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTranslation } from 'next-i18next'

import { openAuthDialog } from '@/app/applicationSlice'
import { useAppDispatch } from '@/app/store'

import styles from './styles.module.sass'

type MenuItemType = {
    icon?: IconTypes
    auth?: boolean
    admin?: boolean
    link?: string
    text: string
    divider?: never
}

type DividerType = {
    divider: true
    icon?: never
    auth?: never
    admin?: never
    link?: never
    text?: never
}

type MenuItem = MenuItemType | DividerType

interface SiteMenuProps {
    type?: 'mobile' | 'desktop'
    userId?: string
    isAuth?: boolean
    userRole?: string
    onClick?: () => void
}

export const SiteMenu: React.FC<SiteMenuProps> = ({ type, userId, isAuth, userRole, onClick }) => {
    const { t } = useTranslation()

    const dispatch = useAppDispatch()

    const menuItems: MenuItem[] = [
        {
            icon: 'Feed',
            link: '/',
            text: t('news-feed', { defaultValue: 'Новостная лента' })
        },
        {
            icon: 'Map',
            link: '/map',
            text: t('map-of-interesting-pages', { defaultValue: 'Карта интересных мест' })
        },
        {
            icon: 'Point',
            link: '/places',
            text: t('all-interesting-places', { defaultValue: 'Все интересные места' })
        },
        {
            auth: true,
            icon: 'PlusCircle',
            link: '/places/create',
            text: t('add-new-place', { defaultValue: 'Добавить место на карту' })
        },
        {
            auth: true,
            icon: 'User',
            link: userId ? `/users/${userId}` : undefined,
            text: t('my-page', { defaultValue: 'Моя страница' })
        },
        {
            auth: true,
            icon: 'Photo',
            link: userId ? `/users/${userId}/photos` : undefined,
            text: t('my-photos', { defaultValue: 'Мои фотографии' })
        },
        {
            icon: 'Bookmark',
            link: '/categories',
            text: t('categories-places', { defaultValue: 'Категории мест' })
        },
        {
            icon: 'Tag',
            link: '/tags',
            text: t('features-of-places', { defaultValue: 'Особенности мест' })
        },
        {
            icon: 'Users',
            link: '/users/',
            text: t('users', { defaultValue: 'Пользователи' })
        },
        { divider: true },
        {
            admin: true,
            icon: 'Settings',
            link: '/admin/achievements',
            text: 'Достижения'
        }
    ]

    const handleClick = (event: React.MouseEvent, item: MenuItemType) => {
        if (item.auth && !isAuth) {
            event.preventDefault()
            dispatch(openAuthDialog())
        }

        onClick?.()
    }

    return (
        <menu className={styles.menu}>
            {menuItems.map((item, i) => {
                if ('divider' in item && item.divider && userRole === 'admin') {
                    return (
                        <li key={`divider${i}`}>
                            <div className={styles.divider} />
                        </li>
                    )
                }

                const menuItem = item as MenuItemType

                if (menuItem.admin && userRole !== 'admin') {
                    return null
                }

                if (!menuItem.link) {
                    return null
                }

                return (
                    <li key={`menu${type}${i}`}>
                        <Link
                            href={menuItem.link}
                            title={menuItem.text}
                            onClick={(event) => handleClick(event, menuItem)}
                        >
                            {menuItem.icon && <Icon name={menuItem.icon} />}
                            {menuItem.text}
                        </Link>
                    </li>
                )
            })}
        </menu>
    )
}
