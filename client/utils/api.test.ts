import { getErrorMessage, isApiValidationErrors } from './api'

describe('isApiValidationErrors', () => {
    it('returns true for an object with a messages field that is an object', () => {
        const response = { messages: { email: 'Invalid email' }, status: 422, error: 0 }
        expect(isApiValidationErrors(response)).toBe(true)
    })

    it('returns false for null', () => {
        expect(isApiValidationErrors(null)).toBe(false)
    })

    it('returns false for undefined', () => {
        expect(isApiValidationErrors(undefined)).toBe(false)
    })

    it('returns false for an object without a messages field', () => {
        expect(isApiValidationErrors({ error: 'some error' })).toBe(false)
    })

    it('returns false when messages is not an object (string)', () => {
        expect(isApiValidationErrors({ messages: 'invalid' })).toBe(false)
    })

    it('returns false for a plain string', () => {
        expect(isApiValidationErrors('error string')).toBe(false)
    })
})

describe('getErrorMessage', () => {
    it('returns undefined when error is falsy (null)', () => {
        expect(getErrorMessage(null)).toBeUndefined()
    })

    it('returns undefined when error is falsy (undefined)', () => {
        expect(getErrorMessage(undefined)).toBeUndefined()
    })

    it('returns the error string directly when error is a string', () => {
        expect(getErrorMessage('Something went wrong')).toBe('Something went wrong')
    })

    it('extracts message from a SerializedError-like object {message: string}', () => {
        expect(getErrorMessage({ message: 'Network error' })).toBe('Network error')
    })

    it('extracts error from FetchBaseQueryError with {data: {messages: {error: string}}}', () => {
        const error = { data: { messages: { error: 'Forbidden' } } }
        expect(getErrorMessage(error)).toBe('Forbidden')
    })

    it('extracts message from {data: {message: string}} format', () => {
        const error = { data: { message: 'Not found' } }
        expect(getErrorMessage(error)).toBe('Not found')
    })

    it('extracts message from {data: string} format', () => {
        const error = { data: 'Unauthorized' }
        expect(getErrorMessage(error)).toBe('Unauthorized')
    })

    it('returns undefined when error object does not match any known shape', () => {
        expect(getErrorMessage({ status: 500, data: { unknown: true } })).toBeUndefined()
    })

    it('returns undefined when messages.error is missing', () => {
        expect(getErrorMessage({ data: { messages: { field: 'Field error' } } })).toBeUndefined()
    })

    it('handles empty object gracefully', () => {
        expect(getErrorMessage({})).toBeUndefined()
    })
})
