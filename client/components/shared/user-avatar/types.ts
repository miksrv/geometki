import React from 'react'

import { ApiModel } from '@/api'

export type SizeType = 'small' | 'tiny' | 'medium'

export interface UserAvatarProps {
    className?: string
    user?: ApiModel.User
    size?: SizeType
    caption?: string | React.ReactNode
    loading?: boolean
    showName?: boolean
    disableLink?: boolean
    hideOnlineIcon?: boolean
}
