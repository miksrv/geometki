import { validateEmail } from './validators'

describe('validateEmail', () => {
    describe('valid email addresses', () => {
        it('accepts a standard email address', () => {
            expect(validateEmail('user@example.com')).toBe(true)
        })

        it('accepts an email with plus-tag and subdomain', () => {
            expect(validateEmail('user+tag@sub.example.co.uk')).toBe(true)
        })

        it('accepts a short TLD email', () => {
            expect(validateEmail('a@b.io')).toBe(true)
        })
    })

    describe('invalid email addresses', () => {
        it('rejects a plain string with no @ or domain', () => {
            expect(validateEmail('notanemail')).toBe(false)
        })

        it('rejects an address with no local part', () => {
            expect(validateEmail('@nodomain.com')).toBe(false)
        })

        it('rejects an address with no domain after @', () => {
            expect(validateEmail('user@')).toBe(false)
        })

        it('rejects an address with a space before @', () => {
            expect(validateEmail('user @example.com')).toBe(false)
        })

        it('rejects an address with no TLD', () => {
            expect(validateEmail('user@domain')).toBe(false)
        })

        it('rejects an empty string', () => {
            expect(validateEmail('')).toBe(false)
        })

        it('rejects undefined', () => {
            expect(validateEmail(undefined)).toBe(false)
        })
    })
})
