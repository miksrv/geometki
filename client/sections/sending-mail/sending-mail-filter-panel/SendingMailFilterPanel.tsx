import React, { useCallback, useMemo } from 'react'
import debounce from 'lodash-es/debounce'
import { Input, Select, SelectOptionType } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { ApiType } from '@/api'

import { SendingMailFilterType } from './types'

import styles from './styles.module.sass'

interface SendingMailFilterPanelProps {
    status?: ApiType.SendingMail.SendingMailStatus
    email?: string
    onChange: (key: keyof SendingMailFilterType, value: string | undefined) => void
}

export const SendingMailFilterPanel: React.FC<SendingMailFilterPanelProps> = ({ status, email, onChange }) => {
    const { t } = useTranslation()

    const statusOptions: Array<SelectOptionType<string>> = useMemo(
        () => [
            { key: '', value: t('sending-mail-admin-filter-status-all') },
            { key: 'created', value: t('sending-mail-status-created') },
            { key: 'process', value: t('sending-mail-status-process') },
            { key: 'completed', value: t('sending-mail-status-completed') },
            { key: 'error', value: t('sending-mail-status-error') },
            { key: 'rejected', value: t('sending-mail-status-rejected') }
        ],
        [t]
    )

    const handleChangeStatus = (selected: Array<SelectOptionType<string>> | undefined) => {
        const val = selected?.[0]?.key
        onChange('status', val || undefined)
    }

    const handleChangeEmail = useCallback(
        debounce((value: string) => {
            onChange('email', value || undefined)
        }, 300),
        [onChange]
    )

    return (
        <div className={styles.component}>
            <Select
                clearable={true}
                placeholder={t('sending-mail-admin-filter-status')}
                options={statusOptions}
                value={status ?? ''}
                onSelect={handleChangeStatus}
            />

            <Input
                clearable={true}
                placeholder={t('sending-mail-admin-filter-email')}
                defaultValue={email ?? ''}
                onChange={(e) => handleChangeEmail(e.target.value)}
                size={'medium'}
            />
        </div>
    )
}
