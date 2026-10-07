import React, { useState } from 'react'
import { cn, Spinner } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'
import type { IMarkdownEditor } from '@uiw/react-markdown-editor'

import styles from './styles.module.sass'

const MarkdownEditor = dynamic(() => import('@uiw/react-markdown-editor'), {
    loading: () => (
        <div className={styles.loader}>
            <Spinner />
        </div>
    ),
    ssr: false
})

/** Formatting the project's markdown texts actually use; no code, tables or todo lists */
const TOOLBAR: IMarkdownEditor['toolbars'] = [
    'bold',
    'italic',
    'strike',
    'header',
    'quote',
    'ulist',
    'olist',
    'link',
    'image'
]

// The library's own string-typed heights are replaced with px numbers
export interface ContentEditorProps extends Omit<IMarkdownEditor, 'minHeight' | 'maxHeight'> {
    disabled?: boolean
    /** Height of the text area before it grows with the content, px (default 120 — about five lines) */
    minHeight?: number
    /** Height at which the text area starts scrolling instead of growing, px (default: unlimited) */
    maxHeight?: number
}

/**
 * Markdown editor for descriptions (place, collection). A project component, not a kit
 * primitive: it wraps @uiw/react-markdown-editor (CodeMirror) and dresses it as a kit
 * `TextArea` — same background, border, radius and focus ring tokens — with a compact
 * toolbar of small icon buttons on top and a preview toggle on the right.
 */
export const ContentEditor: React.FC<ContentEditorProps> = ({
    disabled,
    minHeight = 120,
    maxHeight,
    className,
    onPreviewMode,
    ...props
}) => {
    // The library only narrows the editor to `100% - previewWidth` in preview mode; at a full
    // width preview that is a zero-width CodeMirror wrapping every character onto its own line
    // and growing without end. The editor is hidden in preview mode instead (see styles).
    const [preview, setPreview] = useState(false)

    const handlePreviewMode = (isPreview: boolean) => {
        setPreview(isPreview)
        onPreviewMode?.(isPreview)
    }

    return (
        <div
            className={cn(styles.contentEditor, disabled && styles.disabled, preview && styles.preview, className)}
            style={
                {
                    '--editor-min-height': `${minHeight}px`,
                    '--editor-max-height': maxHeight ? `${maxHeight}px` : 'none'
                } as React.CSSProperties
            }
            aria-disabled={disabled || undefined}
        >
            <MarkdownEditor
                {...props}
                toolbars={TOOLBAR}
                toolbarsMode={['preview']}
                value={props.value || ''}
                previewWidth={'100%'}
                enableScroll={!preview}
                onPreviewMode={handlePreviewMode}
            />
        </div>
    )
}
