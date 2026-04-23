import { ApiType } from '@/api'

export type SendingMailFilterType = Pick<
    ApiType.SendingMail.SendingMailListRequest,
    'status' | 'email' | 'sort' | 'order' | 'page'
>
