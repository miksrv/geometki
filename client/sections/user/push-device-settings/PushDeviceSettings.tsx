import React from 'react'
import { Button } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { NotifyReplace } from '@/app/notificationSlice'
import { useAppDispatch } from '@/app/store'
import usePushSubscription from '@/hooks/usePushSubscription'

import styles from './styles.module.sass'

/**
 * "Push notifications on this device" in the settings: the state and the switch for this
 * browser. Not part of the settings form: turning push on or off takes effect at once,
 * like the browser prompt it may show. Which events are pushed is the form's push column.
 */
export const PushDeviceSettings: React.FC = () => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()

    const { busy, disable, enable, sendTest, state } = usePushSubscription()

    if (state === 'loading') {
        return null
    }

    const handleEnable = async () => {
        const result = await enable()

        // Refused in the browser prompt: the block itself now explains how to unblock it
        if (result === 'denied') {
            return
        }

        void dispatch(
            NotifyReplace({
                id: 'pushEnable',
                title: '',
                message: t(result === 'ok' ? 'push-enabled' : 'push-enable-failed'),
                type: result === 'ok' ? 'success' : 'error'
            })
        )
    }

    const handleTest = async () => {
        const ok = await sendTest()

        void dispatch(
            NotifyReplace({
                id: 'pushTest',
                title: '',
                message: t(ok ? 'push-test-sent' : 'push-test-failed'),
                type: ok ? 'success' : 'error'
            })
        )
    }

    return (
        <div
            className={styles.device}
            aria-live={'polite'}
        >
            <div className={styles.text}>
                <div className={styles.title}>{t('push-device-title')}</div>
                <p className={styles.state}>{t(`push-state_${state}`)}</p>
            </div>

            {state === 'off' && (
                <div className={styles.actions}>
                    <Button
                        size={'medium'}
                        mode={'primary'}
                        loading={busy}
                        disabled={busy}
                        label={t('push-enable')}
                        onClick={() => void handleEnable()}
                    />
                </div>
            )}

            {state === 'on' && (
                <div className={styles.actions}>
                    <Button
                        size={'medium'}
                        mode={'secondary'}
                        disabled={busy}
                        label={t('push-test')}
                        onClick={() => void handleTest()}
                    />
                    <Button
                        size={'medium'}
                        mode={'outline'}
                        loading={busy}
                        disabled={busy}
                        label={t('push-disable')}
                        onClick={() => void disable()}
                    />
                </div>
            )}
        </div>
    )
}
