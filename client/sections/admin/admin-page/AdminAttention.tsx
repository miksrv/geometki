import React, { useId } from 'react'
import { Button, Icon, Skeleton } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { StatusBadge, StatusTone } from '@/components/shared'
import { AdminAttentionItem } from '@/hooks/useAdminAttention'
import { ADMIN_SECTION_TITLES, ADMIN_SECTIONS, AdminSectionKey } from '@/utils/admin'

import styles from './styles.module.sass'

interface AdminAttentionProps {
    items: AdminAttentionItem[]
    loading?: boolean
    /** A source failed to load: with nothing found in the others, no calm line is said */
    error?: boolean
}

const TONES: Record<AdminAttentionItem['tone'], StatusTone> = { danger: 'danger', info: 'info', warning: 'warning' }

/**
 * "Требует внимания", the first block of the dashboard (ADMIN-UI.md → The dashboard): what is
 * broken or about to break across the sections, the worst first — the section it is about, what
 * is wrong and the one link to where it is fixed (none when it is fixed outside the site: the mail job). With nothing to do it is a single calm line.
 */
export const AdminAttention: React.FC<AdminAttentionProps> = ({ items, loading, error }) => {
    const { t } = useTranslation()
    const titleId = useId()

    const sectionTitle = (key: string) => {
        const section = ADMIN_SECTIONS.find((item) => item.key === key)

        return t(section?.title ?? ADMIN_SECTION_TITLES[key as AdminSectionKey] ?? key)
    }

    return (
        <section
            className={styles.attention}
            aria-labelledby={titleId}
        >
            <h2
                id={titleId}
                className={styles.attentionTitle}
            >
                {t('admin-attention-title')}
            </h2>

            {loading && !items.length ? (
                <Skeleton className={styles.skeleton} />
            ) : !items.length && error ? (
                <p className={styles.calm}>{t('admin-widget-error')}</p>
            ) : !items.length ? (
                <p className={styles.calm}>
                    <Icon name={'CheckCircle'} />
                    {t('admin-attention-empty')}
                </p>
            ) : (
                <ul className={styles.attentionList}>
                    {items.map((item) => (
                        <li
                            key={item.key}
                            className={styles.attentionItem}
                        >
                            <StatusBadge
                                label={sectionTitle(item.section)}
                                tone={TONES[item.tone]}
                            />
                            <span className={styles.attentionText}>{item.message}</span>
                            {item.href && (
                                <Button
                                    mode={'secondary'}
                                    size={'small'}
                                    link={item.href}
                                    label={item.action}
                                />
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    )
}
