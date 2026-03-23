import React, { useMemo } from 'react'
import { cn, Container, Message } from 'simple-react-ui-kit'

import Link from 'next/link'
import { useTranslation } from 'next-i18next'

import { ApiModel } from '@/api'
import { dateToUnixTime } from '@/utils/helpers'

import { SortMode } from '../tags-controls'

import styles from './styles.module.sass'

interface TagsGridProps {
    tags: ApiModel.Tag[]
    searchQuery: string
    sortMode: SortMode
    onClearSearch: () => void
}

function popularityClass(count: number | undefined, maxCount: number): 'low' | 'mid' | 'high' {
    if (!count || maxCount === 0) {
        return 'low'
    }
    const ratio = count / maxCount
    if (ratio >= 0.5) {
        return 'high'
    }
    if (ratio >= 0.15) {
        return 'mid'
    }
    return 'low'
}

export const TagsGrid: React.FC<TagsGridProps> = ({ tags, searchQuery, sortMode, onClearSearch }) => {
    const { t } = useTranslation()

    const filteredSorted = useMemo(() => {
        const filtered = tags.filter((tag) => tag.title.toLowerCase().includes(searchQuery.toLowerCase()))

        const sorted = [...filtered]
        if (sortMode === 'popular') {
            sorted.sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
        } else if (sortMode === 'recent') {
            sorted.sort((a, b) => dateToUnixTime(b.updated?.date) - dateToUnixTime(a.updated?.date))
        } else {
            sorted.sort((a, b) => a.title.localeCompare(b.title))
        }

        return sorted
    }, [tags, searchQuery, sortMode])

    const maxCount = useMemo(() => Math.max(...filteredSorted.map((t) => t.count ?? 0), 0), [filteredSorted])

    const rows = useMemo(() => {
        // Группировка по буквам имеет смысл только при алфавитной сортировке
        if (sortMode !== 'alpha') {
            // Для других режимов сортировки возвращаем один блок без буквенной группировки
            return [{ letter: '', tags: filteredSorted }]
        }

        const result: Array<{ letter: string; tags: ApiModel.Tag[] }> = []
        let lastLetter = ''

        filteredSorted.forEach((tag) => {
            const letter = tag.title.charAt(0).toUpperCase()
            if (letter !== lastLetter) {
                lastLetter = letter
                result.push({ letter, tags: [] })
            }
            result[result.length - 1].tags.push(tag)
        })

        return result
    }, [filteredSorted, sortMode])

    if (filteredSorted.length === 0) {
        return (
            <Container className={styles.tagsGrid}>
                <Message type='info'>
                    {t('tags-no-results')}{' '}
                    <button
                        type='button'
                        className={styles.clearBtn}
                        onClick={onClearSearch}
                    >
                        {t('clear')}
                    </button>
                </Message>
            </Container>
        )
    }

    return (
        <Container className={styles.tagsGrid}>
            <div className={styles.grid}>
                {rows.map(({ letter, tags: groupTags }) => (
                    <React.Fragment key={letter || 'all'}>
                        {groupTags.map((tag, index) => (
                            <Link
                                key={tag.title}
                                href={`/places?tag=${tag.title}`}
                                title={tag.title}
                                className={cn(styles.tagCard, styles[popularityClass(tag.count, maxCount)])}
                            >
                                {index === 0 && letter && (
                                    <span
                                        id={`letter-${letter}`}
                                        className={styles.anchor}
                                    />
                                )}
                                <span className={styles.tagTitle}>{tag.title}</span>
                                <span className={styles.tagCount}>{tag.count}</span>
                            </Link>
                        ))}
                    </React.Fragment>
                ))}
            </div>
        </Container>
    )
}
