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

/**
 * Safely extracts error message string from RTK Query error.
 * Handles various error formats: string, {data: string}, {data: {messages: {error: string}}}, {message: string}
 */
export const getErrorMessage = (error: unknown): string | undefined => {
    if (!error) {
        return undefined
    }

    if (typeof error === 'string') {
        return error
    }

    if (typeof error === 'object') {
        // Handle {message: string} format (SerializedError)
        if ('message' in error && typeof (error as { message: unknown }).message === 'string') {
            return (error as { message: string }).message
        }

        // Handle {data: ...} format (FetchBaseQueryError after transformErrorResponse)
        if ('data' in error) {
            const data = (error as { data: unknown }).data

            if (typeof data === 'string') {
                return data
            }

            if (data && typeof data === 'object') {
                // Handle {data: {messages: {error: string}}}
                if ('messages' in data) {
                    const messages = (data as { messages: { error?: string } }).messages
                    return messages?.error
                }

                // Handle {data: {message: string}}
                if ('message' in data && typeof (data as { message: unknown }).message === 'string') {
                    return (data as { message: string }).message
                }
            }
        }
    }

    return undefined
}
