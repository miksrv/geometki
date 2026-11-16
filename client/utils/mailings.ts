import { ApiType } from '@/api'
import { formatDate } from '@/utils/date'

type Mailing = ApiType.Mailings.MailingAdmin

export const MAILING_STATUSES: ApiType.Mailings.MailingStatus[] = ['draft', 'sending', 'completed', 'canceled']

export const isMailingStatus = (value: string | undefined): value is ApiType.Mailings.MailingStatus =>
    !!value && (MAILING_STATUSES as string[]).includes(value)

/** Only a draft is edited, gets a picture or is deleted */
export const isMailingDraft = (mailing?: Pick<Mailing, 'status'>): boolean => mailing?.status === 'draft'

/** How far the sending is: the letters sent or finished with a result, of all the recipients */
export const mailingProgress = (mailing: Pick<Mailing, 'delivery' | 'recipients'>) => {
    const { delivery, recipients } = mailing
    const done = delivery.sent + delivery.failed + delivery.rejected
    const percent = recipients > 0 ? Math.min(100, Math.round((done / recipients) * 100)) : 0

    return { done, percent, recipients }
}

/** A site path or an http(s) address: what the server accepts as a link or a button's address */
export const isMailingUrl = (value: string): boolean =>
    !/[\s"'<>\\\x00-\x1f\x7f]/.test(value) &&
    (/^https?:\/\/[^/?#]+/i.test(value) || (value.startsWith('/') && !value.startsWith('//')))

/** A `Y-m-d H:i:s` time of the mailings API (UTC, like every time of the API) in the visitor's time */
export const formatMailingDate = (value?: string | null, format: string = 'DD.MM.YYYY, HH:mm'): string =>
    value ? formatDate(value, format) : ''
