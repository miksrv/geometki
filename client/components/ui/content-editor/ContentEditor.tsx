import React from 'react'
import { cn, Spinner } from 'simple-react-ui-kit'

import dynamic from 'next/dynamic'
import { IMarkdownEditor } from '@uiw/react-markdown-editor'

import styles from './styles.module.sass'

const MarkdownEditor = dynamic(() => import('@uiw/react-markdown-editor'), {
    loading: () => (
        <div className={styles.loader}>
            <Spinner />
        </div>
    ),
    ssr: false
})

interface ContentEditorProps extends IMarkdownEditor {
    disabled?: boolean
}

export const ContentEditor: React.FC<ContentEditorProps> = (props) => (
    <div className={cn(styles.contentEditor, props?.disabled && styles.disabled)}>
        <MarkdownEditor
            {...props}
            toolbars={['bold', 'italic', 'header', 'strike', 'underline', 'quote', 'link', 'image']}
            value={props.value || ''}
            previewWidth={'100%'}
            enableScroll={true}
        />
    </div>
)
