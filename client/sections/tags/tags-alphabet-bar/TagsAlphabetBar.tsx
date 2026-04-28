import React, { useMemo } from 'react'
import { cn } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { ApiModel } from '@/api'

import { SortMode } from '../tags-controls'

import styles from './styles.module.sass'

const EN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const RU_ALPHABET = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'.split('')

interface TagsAlphabetBarProps {
    tags: ApiModel.Tag[]
    sortMode: SortMode
}

export const TagsAlphabetBar: React.FC<TagsAlphabetBarProps> = ({ tags, sortMode }) => {
    const { i18n } = useTranslation()

    const alphabet = i18n.language === 'ru' ? RU_ALPHABET : EN_ALPHABET

    const activeLetters = useMemo(() => {
        const set = new Set<string>()
        tags.forEach((tag) => {
            const first = tag.title.charAt(0).toUpperCase()
            set.add(first)
        })
        return set
    }, [tags])

    const handleLetterClick = (letter: string) => {
        document.getElementById(`letter-${letter}`)?.scrollIntoView({ behavior: 'smooth' })
    }

    const isAlphaSort = sortMode === 'alpha'

    return (
        <div className={cn(styles.alphabetBar, !isAlphaSort && styles.alphabetBarDisabled)}>
            {alphabet.map((letter) => {
                const isActive = isAlphaSort && activeLetters.has(letter)
                return (
                    <button
                        key={letter}
                        type='button'
                        className={cn(styles.letterBtn, !isActive ? styles.letterBtnDisabled : '')}
                        disabled={!isActive}
                        onClick={() => handleLetterClick(letter)}
                        aria-label={letter}
                    >
                        {letter}
                    </button>
                )
            })}
        </div>
    )
}
