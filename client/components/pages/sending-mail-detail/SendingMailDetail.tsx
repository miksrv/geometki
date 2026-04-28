import React from 'react'
import { Badge, Dialog, Message } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiType } from '@/api'
import { UserAvatar } from '@/components/shared'
import { formatDate } from '@/utils/helpers'

import styles from './SendingMailDetail.module.sass'

interface SendingMailDetailProps {
    id: string | null
    onClose: () => void
}

const getStatusBadgeClass = (
    status: ApiType.SendingMail.SendingMailStatus,
    styleMap: Record<string, string>
): string => {
    switch (status) {
        case 'completed':
            return styleMap.badgeCompleted
        case 'error':
            return styleMap.badgeError
        case 'process':
            return styleMap.badgeProcess
        case 'created':
        case 'rejected':
            return styleMap.badgeDefault
    }
}

export const SendingMailDetail: React.FC<SendingMailDetailProps> = ({ id, onClose }) => {
    const { t } = useTranslation()

    const { data } = API.useGetSendingMailItemQuery(id!, { skip: !id })

    const item = data?.data

    return (
        <Dialog
            open={!!id}
            title={t('sending-mail-admin-modal-title')}
            showCloseButton={true}
            contentClassName={styles.dialog}
            onCloseDialog={onClose}
        >
            {item && (
                <div className={styles.content}>
                    <div className={styles.header}>
                        <h3 className={styles.title}>
                            {item?.activity?.type ? t(`notification_${item?.activity?.type}`) : item.subject}
                        </h3>
                        <Badge
                            label={t(`sending-mail-status-${item.status}`)}
                            className={getStatusBadgeClass(item.status, styles)}
                        />
                    </div>

                    <dl className={styles.meta}>
                        <dt>{t('sending-mail-admin-modal-recipient')}</dt>
                        <dd>{item.email ?? '—'}</dd>

                        <dt>{t('sending-mail-admin-col-user')}</dt>
                        <dd>
                            {item.user ? (
                                <UserAvatar
                                    size={'small'}
                                    showName={true}
                                    user={item.user}
                                />
                            ) : (
                                <span className={styles.noUser}>{t('sending-mail-admin-modal-no-user')}</span>
                            )}
                        </dd>

                        <dt>{t('sending-mail-admin-col-created-at')}</dt>
                        <dd>{formatDate(item.created?.date, 'D MMM YYYY, HH:mm')}</dd>

                        <dt>{t('sending-mail-admin-col-processed-at')}</dt>
                        <dd>{formatDate(item.updated?.date, 'D MMM YYYY, HH:mm')}</dd>
                    </dl>

                    {item.status === 'error' && item.error && (
                        <div className={styles.section}>
                            <p className={styles.sectionLabel}>{t('sending-mail-admin-modal-error')}</p>
                            <Message
                                type={'error'}
                                title={item.error}
                            />
                        </div>
                    )}
                </div>
            )}
        </Dialog>
    )
}

export default SendingMailDetail
