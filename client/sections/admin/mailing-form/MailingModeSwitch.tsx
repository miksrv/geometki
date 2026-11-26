import React from 'react'
import { Button } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'
import { isMailingDraft } from '@/utils/mailings'

import styles from './styles.module.sass'

/** The fields of the letter, or the letter as it will come */
export type MailingFormMode = 'edit' | 'preview'

/** A draft (and a mailing still loading: its form stands disabled) opens on its fields, a sent one on its letter */
export const defaultMailingMode = (mailing?: Pick<ApiType.Mailings.MailingAdmin, 'status'>): MailingFormMode =>
    !mailing || isMailingDraft(mailing) ? 'edit' : 'preview'

interface MailingModeSwitchProps {
    mode: MailingFormMode
    /** A sent mailing: its fields are read-only, «Содержание» instead of «Редактирование» */
    readOnly?: boolean
    disabled?: boolean
    onChange: (mode: MailingFormMode) => void
}

/** The two modes of the mailing's page, on the title line: the pressed one is the primary button */
export const MailingModeSwitch: React.FC<MailingModeSwitchProps> = ({ mode, readOnly, disabled, onChange }) => {
    const { t } = useTranslation()

    const modes: Array<{ key: MailingFormMode; label: string; icon: 'Pencil' | 'Eye' }> = [
        { icon: 'Pencil', key: 'edit', label: t(readOnly ? 'admin-mailing-mode-content' : 'admin-mailing-mode-edit') },
        { icon: 'Eye', key: 'preview', label: t('admin-mailing-mode-preview') }
    ]

    return (
        <div
            role={'group'}
            aria-label={t('admin-mailing-mode')}
            className={styles.modeSwitch}
        >
            {modes.map((item) => (
                <Button
                    key={item.key}
                    size={'medium'}
                    mode={item.key === mode ? 'primary' : 'secondary'}
                    icon={item.icon}
                    label={item.label}
                    aria-pressed={item.key === mode}
                    disabled={disabled}
                    onClick={() => onChange(item.key)}
                />
            ))}
        </div>
    )
}
