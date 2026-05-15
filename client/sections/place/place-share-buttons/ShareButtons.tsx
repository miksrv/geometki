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

import styles from './styles.module.sass'

interface ShareButtonsProps {
    placeUrl: string
}

const ShareButtons: React.FC<ShareButtonsProps> = ({ placeUrl }) => (
    <div className={styles.share}>
        <TelegramShareButton url={placeUrl}>
            <TelegramIcon size={22} />
        </TelegramShareButton>

        <WhatsappShareButton url={placeUrl}>
            <WhatsappIcon size={22} />
        </WhatsappShareButton>

        <ViberShareButton url={placeUrl}>
            <ViberIcon size={22} />
        </ViberShareButton>

        <VKShareButton url={placeUrl}>
            <VKIcon size={22} />
        </VKShareButton>

        <OKShareButton url={placeUrl}>
            <OKIcon size={22} />
        </OKShareButton>

        <RedditShareButton url={placeUrl}>
            <RedditIcon size={22} />
        </RedditShareButton>
    </div>
)

export default ShareButtons
