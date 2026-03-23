import React from 'react'
import { Button, cn, Container, Icon, Input, Popout } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next'

import styles from './styles.module.sass'

export type SortMode = 'popular' | 'recent' | 'alpha'

interface TagsControlsProps {
    searchQuery: string
    sortMode: SortMode
    onSearchChange: (value: string) => void
    onSortChange: (mode: SortMode) => void
}

const SORT_OPTIONS: Array<{ key: SortMode; labelKey: string }> = [
    { key: 'popular', labelKey: 'tags-sort-popular' },
    { key: 'recent', labelKey: 'tags-sort-recent' },
    { key: 'alpha', labelKey: 'tags-sort-alpha' }
]

export const TagsControls: React.FC<TagsControlsProps> = ({ searchQuery, sortMode, onSearchChange, onSortChange }) => {
    const { t } = useTranslation()

    return (
        <Container className={styles.tagsControls}>
            <div className={styles.controlsRow}>
                <div className={styles.searchWrapper}>
                    <Icon
                        name='Search'
                        className={styles.searchIcon}
                    />
                    <Input
                        mode='ghost'
                        placeholder={t('tags-search-placeholder')}
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className={styles.searchInput}
                    />
                </div>
                <Popout
                    closeOnChildrenClick
                    position='right'
                    trigger={
                        <Button
                            mode='outline'
                            size='small'
                            icon='Tune'
                        />
                    }
                >
                    <ul className={styles.sortList}>
                        {SORT_OPTIONS.map(({ key, labelKey }) => (
                            <li key={key}>
                                <button
                                    type='button'
                                    className={cn(styles.sortOption, key === sortMode ? styles.sortOptionActive : '')}
                                    onClick={() => onSortChange(key)}
                                >
                                    {t(labelKey)}
                                </button>
                            </li>
                        ))}
                    </ul>
                </Popout>
            </div>
        </Container>
    )
}
