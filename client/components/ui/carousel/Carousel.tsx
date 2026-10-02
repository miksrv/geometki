import React from 'react'
import { EmblaOptionsType } from 'embla-carousel'
import useEmblaCarousel from 'embla-carousel-react'

import { useTranslation } from 'next-i18next/pages'

import { NextButton, PrevButton, usePrevNextButtons } from './CarouselButtons'

import styles from './styles.module.sass'

interface CarouselProps {
    options?: EmblaOptionsType
    children?: React.ReactNode
}

export const Carousel: React.FC<CarouselProps> = ({ options, children }) => {
    const { t } = useTranslation()
    const [emblaRef, emblaApi] = useEmblaCarousel(options)

    const { prevBtnDisabled, nextBtnDisabled, onPrevButtonClick, onNextButtonClick } = usePrevNextButtons(emblaApi)

    return (
        <div className={styles.carousel}>
            <div
                ref={emblaRef}
                className={styles.viewport}
            >
                <div className={styles.container}>
                    {React.Children.map(children, (child) =>
                        child ? <div className={styles.slide}>{child}</div> : null
                    )}
                </div>
            </div>

            <div className={styles.buttonsContainer}>
                <PrevButton
                    aria-label={t('prev', { defaultValue: 'Назад' })}
                    onClick={onPrevButtonClick}
                    disabled={prevBtnDisabled}
                />
                <NextButton
                    aria-label={t('next', { defaultValue: 'Вперёд' })}
                    onClick={onNextButtonClick}
                    disabled={nextBtnDisabled}
                />
            </div>
        </div>
    )
}
