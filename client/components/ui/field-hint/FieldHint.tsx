import React from 'react'

import styles from './styles.module.sass'

export interface FieldHintProps {
    /** The id the field points at with `aria-describedby` */
    id?: string
    children: React.ReactNode
}

/**
 * A line of help under a field or a group of fields, in caption secondary text (DESIGN.md → Form
 * fields). The kit fields have no `hint` of their own (a kit candidate), so the field gets
 * `aria-describedby={id}`; `HintedField` wires the two.
 */
export const FieldHint: React.FC<FieldHintProps> = ({ id, children }) => (
    <p
        id={id}
        className={styles.hint}
    >
        {children}
    </p>
)

export interface HintedFieldProps {
    /** Unique on the page: the hint's id is `<id>-hint` */
    id: string
    hint?: React.ReactNode
    /** The field; takes the value for its `aria-describedby` (undefined without a hint) */
    children: (describedBy: string | undefined) => React.ReactNode
    className?: string
}

/** A field with its hint right under it, tied by `aria-describedby` */
export const HintedField: React.FC<HintedFieldProps> = ({ id, hint, children, className }) => {
    const hintId = hint ? `${id}-hint` : undefined

    return (
        <div className={className ? `${styles.field} ${className}` : styles.field}>
            {children(hintId)}
            {hint && <FieldHint id={hintId}>{hint}</FieldHint>}
        </div>
    )
}
