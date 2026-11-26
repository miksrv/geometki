import React, { useEffect, useRef, useState } from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import { useTranslation } from 'next-i18next/pages'

import { API, ApiType } from '@/api'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

import styles from './styles.module.sass'

/** The pause after typing before the letter is drawn again */
export const MAILING_PREVIEW_DELAY = 600

interface MailingPreviewProps {
    /** The form as it is now, saved or not */
    values: ApiType.Mailings.MailingInput
    /** The saved mailing: the picture is taken from it */
    mailingId?: string
}

/**
 * The live preview of a letter (`POST mailings/preview`): the real email template drawn on the
 * server from the unsaved form, in a frame without scripts, under the subject as an inbox line.
 */
export const MailingPreview: React.FC<MailingPreviewProps> = ({ values, mailingId }) => {
    const { t } = useTranslation()

    const [preview, setPreview] = useState<ApiType.Mailings.MailingPreviewResponse>()
    const [failed, setFailed] = useState<boolean>(false)
    const [loading, setLoading] = useState<boolean>(true)
    const [render] = API.useMailingsPostPreviewMutation()
    const latest = useRef<number>(0)

    const debounced = useDebouncedValue(values, MAILING_PREVIEW_DELAY)

    useEffect(() => {
        const request = ++latest.current

        setLoading(true)

        render({ ...debounced, id: mailingId })
            .unwrap()
            .then((result) => {
                if (request === latest.current) {
                    setPreview(result)
                    setFailed(false)
                }
            })
            .catch(() => request === latest.current && setFailed(true))
            .finally(() => request === latest.current && setLoading(false))
    }, [debounced, mailingId, render])

    return (
        <Container className={styles.preview}>
            <div
                className={styles.inboxLine}
                aria-live={'polite'}
            >
                {preview ? (
                    <>
                        <span className={styles.inboxLabel}>{t('admin-mailing-preview-subject')}</span>
                        <b>{preview.subject || '—'}</b>
                    </>
                ) : (
                    <Skeleton style={{ height: 20, width: '60%' }} />
                )}
            </div>

            {failed && <p className={styles.previewNote}>{t('admin-mailing-preview-failed')}</p>}

            {preview ? (
                <iframe
                    className={styles.frame}
                    title={t('admin-mailing-preview')}
                    srcDoc={preview.html}
                    sandbox={''}
                    data-loading={loading || undefined}
                />
            ) : (
                <Skeleton style={{ height: 420, width: '100%' }} />
            )}
        </Container>
    )
}
