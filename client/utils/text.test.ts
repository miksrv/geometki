import { isValidJSON, removeMarkdown, truncateText } from './text'

describe('truncateText', () => {
    it('returns undefined when text is undefined', () => {
        expect(truncateText(undefined)).toBeUndefined()
    })

    it('returns the text unchanged when shorter than maxLength', () => {
        expect(truncateText('short', 100)).toBe('short')
    })

    it('returns the text unchanged when equal to maxLength', () => {
        const text = 'exact'
        expect(truncateText(text, text.length)).toBe(text)
    })

    it('truncates at the last space before maxLength', () => {
        expect(truncateText('hello world foo', 12)).toBe('hello world')
    })

    it('truncates at maxLength when no space exists', () => {
        expect(truncateText('abcdefghij', 5)).toBe('abcde')
    })

    it('returns empty string for empty input', () => {
        expect(truncateText('')).toBe('')
    })
})

describe('removeMarkdown', () => {
    it('returns empty string for undefined', () => {
        expect(removeMarkdown(undefined)).toBe('')
    })

    it('strips bold syntax', () => {
        expect(removeMarkdown('**bold**')).toBe('bold')
    })

    it('strips inline code', () => {
        expect(removeMarkdown('`code`')).toBe('code')
    })

    it('strips strikethrough', () => {
        expect(removeMarkdown('~~strike~~')).toBe('strike')
    })

    it('strips markdown link syntax and returns the link text', () => {
        expect(removeMarkdown('[click here](https://example.com)')).toBe('click here')
    })

    it('strips h1 header markers', () => {
        const result = removeMarkdown('# Title')
        expect(result).not.toContain('#')
        expect(result.trim()).toBe('Title')
    })

    it('strips blockquote markers', () => {
        const result = removeMarkdown('> quote text')
        expect(result).not.toContain('>')
    })

    it('strips unordered list markers', () => {
        const result = removeMarkdown('- item one')
        expect(result).not.toContain('- ')
        expect(result.trim()).toBe('item one')
    })

    it('strips ordered list markers', () => {
        const result = removeMarkdown('1. first item')
        expect(result.trim()).toBe('first item')
    })

    it('returns plain text unchanged', () => {
        expect(removeMarkdown('Hello world')).toBe('Hello world')
    })
})

describe('isValidJSON', () => {
    it('returns true for null input', () => {
        expect(isValidJSON(null as unknown as string)).toBe(true)
    })

    it('returns true for empty string', () => {
        expect(isValidJSON('')).toBe(true)
    })

    it('returns true for a valid JSON object string', () => {
        expect(isValidJSON('{"key":"value"}')).toBe(true)
    })

    it('returns true for a valid JSON array string', () => {
        expect(isValidJSON('[1,2,3]')).toBe(true)
    })

    it('returns true for a valid JSON primitive string', () => {
        expect(isValidJSON('42')).toBe(true)
        expect(isValidJSON('"hello"')).toBe(true)
        expect(isValidJSON('true')).toBe(true)
        expect(isValidJSON('null')).toBe(true)
    })

    it('returns false for malformed JSON', () => {
        expect(isValidJSON('{key: value}')).toBe(false)
        expect(isValidJSON('{"unclosed":')).toBe(false)
    })

    it('returns false for the string "undefined"', () => {
        expect(isValidJSON('undefined')).toBe(false)
    })
})
