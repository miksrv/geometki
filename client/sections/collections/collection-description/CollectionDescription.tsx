import React from 'react'
import Markdown from 'react-markdown'

import dynamic from 'next/dynamic'
import { useTranslation } from 'next-i18next/pages'

import styles from '../styles.module.sass'

const ContentEditor = dynamic(
    () => import('@/components/ui/content-editor/ContentEditor').then((m) => ({ default: m.ContentEditor })),
    { ssr: false }
)

interface CollectionDescriptionProps {
    description?: string | null
    /** Owner edit mode: shows the markdown editor bound to `draft` instead of the text */
    editable?: boolean
    /** Current editor value in edit mode; owned by the page, saved with the header's "Готово" */
    draft?: string
    saving?: boolean
    onChange?: (draft: string) => void
}

/**
 * The collection's text, rendered as article prose right under the map: no container and
 * no heading, the page title is the heading. Hidden when empty for readers; the owner in
 * edit mode gets the inline markdown editor in its place. The editor has no buttons of its
 * own — all edits of the page are confirmed by one "Готово" in the header.
 */
export const CollectionDescription: React.FC<CollectionDescriptionProps> = ({
    description,
    editable,
    draft,
    saving,
    onChange
}) => {
    const { t } = useTranslation()

    if (editable) {
        return (
            <section className={styles.descriptionEditor}>
                <ContentEditor
                    value={draft ?? ''}
                    disabled={saving}
                    placeholder={t('collections_description-placeholder', {
                        defaultValue: 'Расскажите, чем интересны эти места, как до них добраться, когда лучше ехать'
                    })}
                    onChange={(value) => onChange?.(value)}
                />
            </section>
        )
    }

    if (!description) {
        return null
    }

    return (
        <section className={styles.description}>
            <Markdown
                components={{
                    a: ({ node: _node, ...props }) => (
                        <a
                            {...props}
                            rel={'nofollow ugc'}
                        />
                    )
                }}
            >
                {description ?? ''}
            </Markdown>
        </section>
    )
}
