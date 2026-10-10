import React from 'react'
import {
    OKIcon,
    OKShareButton,
    RedditIcon,
    RedditShareButton,
    TelegramIcon,
    TelegramShareButton,
    ViberIcon,
    ViberShareButton,
    VKIcon,
    VKShareButton,
    WhatsappIcon,
    WhatsappShareButton
} from 'react-share'
import { Tooltip } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import styles from './styles.module.sass'

interface ShareButtonsProps {
    placeUrl: string
}

const ShareButtons: React.FC<ShareButtonsProps> = ({ placeUrl }) => {
    const { t } = useTranslation()

    const shareIn = (network: string) => t('share-in', { defaultValue: 'Поделиться в {{network}}', network })

    return (
        <div className={styles.share}>
            <Tooltip content={shareIn('Telegram')}>
                <TelegramShareButton url={placeUrl}>
                    <TelegramIcon size={22} />
                </TelegramShareButton>
            </Tooltip>

            <Tooltip content={shareIn('WhatsApp')}>
                <WhatsappShareButton url={placeUrl}>
                    <WhatsappIcon size={22} />
                </WhatsappShareButton>
            </Tooltip>

            <Tooltip content={shareIn('Viber')}>
                <ViberShareButton url={placeUrl}>
                    <ViberIcon size={22} />
                </ViberShareButton>
            </Tooltip>

            <Tooltip content={shareIn('VK')}>
                <VKShareButton url={placeUrl}>
                    <VKIcon size={22} />
                </VKShareButton>
            </Tooltip>

            <Tooltip content={shareIn('OK')}>
                <OKShareButton url={placeUrl}>
                    <OKIcon size={22} />
                </OKShareButton>
            </Tooltip>

            <Tooltip content={shareIn('Reddit')}>
                <RedditShareButton url={placeUrl}>
                    <RedditIcon size={22} />
                </RedditShareButton>
            </Tooltip>
        </div>
    )
}

export default ShareButtons
