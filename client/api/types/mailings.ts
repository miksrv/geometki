/** Admin mailings (`/admin/mailings`, server: `Controllers/Mailings.php`) */

export type MailingStatus = 'draft' | 'sending' | 'completed' | 'canceled'

/** `POST mailings`, `PATCH mailings/:id` (snake_case like the seasons); a mailing is in Russian only */
export interface MailingInput {
    subject: string
    content: string
    button_label?: string
    button_url?: string
}

/** Counts of the mailing's rows of the sending log; zeros for a draft */
export interface MailingDelivery {
    sent: number
    pending: number
    failed: number
    rejected: number
}

export interface MailingAdmin {
    id: string
    status: MailingStatus
    subject: string
    content: string
    button_label: string | null
    button_url: string | null
    /** Relative `uploads/mailings/...` path, or none */
    image: string | null
    author: { id: string; name: string; avatar?: string } | null
    /** `Y-m-d H:i:s`, UTC */
    created_at: string
    updated_at: string
    sent_at: string | null
    completed_at: string | null
    recipients: number
    delivery: MailingDelivery
}

export interface MailingStats {
    total: number
    draft: number
    sending: number
    completed: number
    canceled: number
}

export interface MailingListRequest {
    status?: MailingStatus
    page?: number
    limit?: number
}

export interface MailingListResponse {
    items: MailingAdmin[]
    count: number
    stats: MailingStats
}

/** `GET mailings/audience`: who would get a letter if it were sent now */
export interface MailingAudience {
    total: number
}

/** `POST mailings/preview`: the unsaved form, the picture of the saved mailing `id` */
export interface MailingPreviewRequest extends MailingInput {
    id?: string
}

export interface MailingPreviewResponse {
    html: string
    subject: string
}

export interface MailingTestResponse {
    email: string
}
