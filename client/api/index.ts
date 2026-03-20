import { API } from './api'
import * as ApiModel from './models'
import { useAppDispatch, useAppSelector } from '@/app/store'
import * as ApiType from './types'

export { IMG_HOST, SITE_LINK } from '@/config/env'

interface ApiResponseError<T> {
    status: number
    error: number
    messages: Record<keyof T, string>
}

export const isApiValidationErrors = <T>(response: unknown): response is ApiResponseError<T> =>
    typeof response === 'object' &&
    response != null &&
    'messages' in response &&
    typeof (response as ApiResponseError<string>).messages === 'object'

export { API, ApiModel, ApiType, useAppDispatch, useAppSelector }
