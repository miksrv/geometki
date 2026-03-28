import { encodeQueryData, makeActiveLink, removeProtocolFromUrl } from './url'

describe('encodeQueryData', () => {
    it('returns empty string for undefined', () => {
        expect(encodeQueryData(undefined)).toBe('')
    })

    it('returns empty string for null', () => {
        expect(encodeQueryData(null)).toBe('')
    })

    it('returns empty string for an empty object', () => {
        expect(encodeQueryData({})).toBe('')
    })

    it('encodes a single key-value pair', () => {
        expect(encodeQueryData({ page: 2 })).toBe('?page=2')
    })

    it('encodes multiple key-value pairs', () => {
        expect(encodeQueryData({ a: '1', b: '2' })).toBe('?a=1&b=2')
    })

    it('encodes special characters in keys and values', () => {
        const result = encodeQueryData({ 'key space': 'val&ue' })
        expect(result).toBe('?key%20space=val%26ue')
    })

    it('ignores keys with undefined or null values', () => {
        expect(encodeQueryData({ a: 'keep', b: undefined, c: null })).toBe('?a=keep')
    })

    it('ignores keys with empty string values', () => {
        expect(encodeQueryData({ a: 'keep', b: '' })).toBe('?a=keep')
    })

    it('ignores keys with false values', () => {
        expect(encodeQueryData({ a: 'keep', b: false })).toBe('?a=keep')
    })
})

describe('makeActiveLink', () => {
    it('returns empty string for empty input', () => {
        expect(makeActiveLink('')).toBe('')
    })

    it('returns the link unchanged when it starts with https://', () => {
        expect(makeActiveLink('https://example.com')).toBe('https://example.com')
    })

    it('returns the link unchanged when it starts with http://', () => {
        expect(makeActiveLink('http://example.com')).toBe('http://example.com')
    })

    it('prepends https:// when protocol is absent', () => {
        expect(makeActiveLink('example.com')).toBe('https://example.com')
    })

    it('prepends https:// for www. links', () => {
        expect(makeActiveLink('www.example.com')).toBe('https://www.example.com')
    })
})

describe('removeProtocolFromUrl', () => {
    it('removes http://', () => {
        expect(removeProtocolFromUrl('http://example.com')).toBe('example.com')
    })

    it('removes https://', () => {
        expect(removeProtocolFromUrl('https://example.com')).toBe('example.com')
    })

    it('does not alter URLs without http(s) prefix', () => {
        expect(removeProtocolFromUrl('www.example.com')).toBe('www.example.com')
        expect(removeProtocolFromUrl('ftp://example.com')).toBe('ftp://example.com')
    })

    it('handles an empty string', () => {
        expect(removeProtocolFromUrl('')).toBe('')
    })

    it('removes protocol from a URL with path and query', () => {
        expect(removeProtocolFromUrl('https://example.com/path?q=1')).toBe('example.com/path?q=1')
    })
})
