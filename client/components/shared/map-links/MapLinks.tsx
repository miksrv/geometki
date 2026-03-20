import React from 'react'

import Image, { StaticImageData } from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'next-i18next'

import { ApiType } from '@/api'
import googleLogo from '@/public/images/google-logo.png'
import wikimapiaLogo from '@/public/images/wikimapia-logo.png'
import yandexLogo from '@/public/images/yandex-logo.png'

import styles from './styles.module.sass'

const DEFAULT_ZOOM = 17

interface MapLinksProps extends ApiType.Coordinates {
    asListItem?: boolean
    zoom?: number
    title?: string
    showTitle?: boolean
}

export const MapLinks: React.FC<MapLinksProps> = (props) =>
    props?.asListItem ? (
        <>
            <li>
                <Yandex {...props} />
            </li>
            <li>
                <Google {...props} />
            </li>
            <li>
                <Wikimapia {...props} />
            </li>
        </>
    ) : (
        <>
            <Yandex {...props} />
            <Google {...props} />
            <Wikimapia {...props} />
        </>
    )

const Yandex: React.FC<MapLinksProps> = (props) => {
    const { t } = useTranslation()

    return (
        <ServiceMapLink
            {...props}
            image={yandexLogo}
            caption={t('map-link-on-Yandex')}
            link={`https://yandex.ru/maps/?pt=${props.lon},${props.lat}&spn=0.1,0.1&l=sat,skl&z=${props.zoom ?? DEFAULT_ZOOM}`}
        />
    )
}

const Google: React.FC<MapLinksProps> = (props) => {
    const { t, i18n } = useTranslation()

    return (
        <ServiceMapLink
            {...props}
            image={googleLogo}
            caption={t('map-link-on-Google')}
            link={`https://maps.google.com/maps?ll=${props.lat},${props.lon}&q=${props.lat},${props.lon}&z=${props.zoom ?? DEFAULT_ZOOM}&spn=0.1,0.1&t=h&hl=${i18n.language}`}
        />
    )
}

const Wikimapia: React.FC<MapLinksProps> = (props) => {
    const { t, i18n } = useTranslation()

    return (
        <ServiceMapLink
            {...props}
            image={wikimapiaLogo}
            caption={t('map-link-on-Wikimapia')}
            link={`https://wikimapia.org/#lang=${i18n.language}&lat=${props.lat}&lon=${props.lon}&z=${props.zoom ?? DEFAULT_ZOOM}&m=w`}
        />
    )
}

interface ServiceMapLinkProps {
    link: string
    title?: string
    caption?: string
    showTitle?: boolean
    image?: StaticImageData
}

const ServiceMapLink: React.FC<ServiceMapLinkProps> = ({ link, image, title, caption, showTitle }) => (
    <Link
        className={styles.mapLink}
        color={'inherit'}
        target={'_blank'}
        title={`${title ? `${title} ` : ''}${caption}`}
        href={link}
    >
        {image && (
            <Image
                src={image.src}
                width={14}
                height={14}
                alt={caption || ''}
            />
        )}
        {showTitle && caption}
    </Link>
)
