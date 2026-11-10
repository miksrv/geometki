import React, { useEffect, useRef, useState } from 'react'
import { Button, cn } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import useIsPhone from '@/hooks/useIsPhone'

import styles from './styles.module.sass'

// The bottom navigation covers the bottom of a phone screen (`$bottomNavHeight`)
const BOTTOM_NAV_HEIGHT = 52

export interface FormActionsProps {
    /** There are unsaved changes: Save is enabled, the note shows, the row floats while out of view */
    dirty?: boolean
    /** Saving: Save spins, both buttons are disabled */
    loading?: boolean
    /** The note on the left while there are changes; "Есть несохранённые изменения" by default */
    message?: string
    /** "Сохранить" by default ("Добавить" for a new entity, say) */
    saveLabel?: string
    /** "Отмена" by default */
    cancelLabel?: string
    onSave?: () => void
    /** No Cancel button without it */
    onCancel?: () => void
}

/**
 * The Cancel / Save row at the end of a page form (DESIGN.md → Patterns → Page form actions).
 * In its place under the form; while there are changes and the place is below the screen, the
 * same row is a bar fixed to the bottom of the screen on its full width, dressed as the app
 * bar (over the bottom navigation on phones), and lands back in its place as it scrolls in.
 */
export const FormActions: React.FC<FormActionsProps> = ({
    dirty,
    loading,
    message,
    saveLabel,
    cancelLabel,
    onSave,
    onCancel
}) => {
    const { t } = useTranslation()
    const isPhone = useIsPhone()
    const slotRef = useRef<HTMLDivElement>(null)
    const rowRef = useRef<HTMLDivElement>(null)
    const [below, setBelow] = useState<boolean>(false)
    const [slotHeight, setSlotHeight] = useState<number>()

    const floating = !!dirty && below

    useEffect(() => {
        const slot = slotRef.current

        if (!slot || typeof IntersectionObserver === 'undefined') {
            return
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                const rootTop = entry.rootBounds?.top ?? 0
                // Not wholly on screen and under its top edge: the place is below the screen
                setBelow(entry.intersectionRatio < 1 && entry.boundingClientRect.top > rootTop)
            },
            {
                threshold: [0, 1],
                rootMargin: `0px 0px -${isPhone ? BOTTOM_NAV_HEIGHT : 0}px 0px`
            }
        )

        observer.observe(slot)

        return () => observer.disconnect()
    }, [isPhone])

    // The place keeps the row's height while the row floats, so the page does not jump
    useEffect(() => {
        if (!floating && rowRef.current) {
            setSlotHeight(rowRef.current.offsetHeight)
        }
    }, [floating, dirty, isPhone])

    return (
        <div
            ref={slotRef}
            className={styles.slot}
            style={floating ? { minHeight: slotHeight } : undefined}
        >
            <div
                ref={rowRef}
                className={cn(styles.formActions, floating && styles.floating)}
            >
                <div className={styles.wrapper}>
                    {dirty && <span className={styles.message}>{message ?? t('form-unsaved')}</span>}

                    <div className={styles.buttons}>
                        {onCancel && (
                            <Button
                                size={'medium'}
                                mode={'secondary'}
                                label={cancelLabel ?? t('cancel')}
                                disabled={loading}
                                onClick={onCancel}
                            />
                        )}

                        <Button
                            size={'medium'}
                            mode={'primary'}
                            loading={loading}
                            label={saveLabel ?? t('save')}
                            disabled={loading || !dirty}
                            onClick={onSave}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
