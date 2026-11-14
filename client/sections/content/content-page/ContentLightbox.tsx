import React from 'react'
import Lightbox, { SlideImage } from 'yet-another-react-lightbox'
import Captions from 'yet-another-react-lightbox/plugins/captions'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'

import 'yet-another-react-lightbox/plugins/captions.css'
import 'yet-another-react-lightbox/styles.css'

export interface ContentLightboxProps {
    /** The photos of the page in its order */
    slides: SlideImage[]
    /** The photo open, -1 for none */
    index: number
    onClose: () => void
}

/**
 * The lightbox of a page's photos (`ContentPage`): every photo of the text in one row to browse,
 * zoom, the alt text as the caption. Loaded with the first click on a photo.
 */
export const ContentLightbox: React.FC<ContentLightboxProps> = ({ slides, index, onClose }) => (
    <Lightbox
        open={index >= 0}
        index={Math.max(index, 0)}
        slides={slides}
        close={onClose}
        plugins={[Captions, Zoom]}
        carousel={{ finite: slides.length <= 1 }}
    />
)
