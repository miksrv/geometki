import * as helpers from './helpers'

describe('helpers', () => {
    describe('truncateText', () => {
        it('returns the same text if it is shorter than the maxLength', () => {
            const text = 'Short text'
            const result = helpers.truncateText(text, 100)
            expect(result).toBe(text)
        })

        it('returns the same text if it is exactly the maxLength', () => {
            const text = 'Exact length text'
            const maxLength = text.length
            const result = helpers.truncateText(text, maxLength)
            expect(result).toBe(text)
        })

        it('truncates the text at the last space before maxLength', () => {
            const text = 'This is a longer text that needs to be truncated'
            const result = helpers.truncateText(text, 20)
            expect(result).toBe('This is a longer')
        })

        it('truncates the text exactly at maxLength if there is no space', () => {
            const text = 'ThisIsALongWordThatExceedsMaxLength'
            const result = helpers.truncateText(text, 10)
            expect(result).toBe('ThisIsALon')
        })

        it('returns undefined if text is undefined', () => {
            const result = helpers.truncateText(undefined, 10)
            expect(result).toBeUndefined()
        })

        it('returns the text as is if maxLength is greater than text length', () => {
            const text = 'Sample text'
            const result = helpers.truncateText(text, 100)
            expect(result).toBe(text)
        })

        it('handles text with multiple spaces correctly', () => {
            const text = 'This   is    a   test   with  multiple   spaces'
            const result = helpers.truncateText(text, 15)
            expect(result).toBe('This   is    a ')
        })

        it('handles empty string correctly', () => {
            const text = ''
            const result = helpers.truncateText(text, 10)
            expect(result).toBe('')
        })

        it('handles zero maxLength correctly', () => {
            const text = 'This is a test'
            const result = helpers.truncateText(text, 0)
            expect(result).toBe('')
        })
    })

    describe('encodeQueryData', () => {
        it('returns an empty string if data is undefined', () => {
            const result = helpers.encodeQueryData(undefined)
            expect(result).toBe('')
        })

        it('returns an empty string if data is null', () => {
            const result = helpers.encodeQueryData(null)
            expect(result).toBe('')
        })

        it('returns an empty string if data is an empty object', () => {
            const result = helpers.encodeQueryData({})
            expect(result).toBe('')
        })

        it('encodes a single key-value pair correctly', () => {
            const data = { key: 'value' }
            const result = helpers.encodeQueryData(data)
            expect(result).toBe('?key=value')
        })

        it('encodes multiple key-value pairs correctly', () => {
            const data = { key1: 'value1', key2: 'value2' }
            const result = helpers.encodeQueryData(data)
            expect(result).toBe('?key1=value1&key2=value2')
        })

        it('encodes special characters correctly', () => {
            const data = {
                'another&key': 'value/with?special#chars',
                'special key': 'value with spaces'
            }
            const result = helpers.encodeQueryData(data)
            expect(result).toBe('?another%26key=value%2Fwith%3Fspecial%23chars&special%20key=value%20with%20spaces')
        })

        it('ignores keys with undefined or null values', () => {
            const data = {
                key1: 'value1',
                key2: undefined,
                key3: null,
                key4: 'value4'
            }
            const result = helpers.encodeQueryData(data)
            expect(result).toBe('?key1=value1&key4=value4')
        })

        it('handles numeric values correctly', () => {
            const data = { key1: 123, key2: 456.789 }
            const result = helpers.encodeQueryData(data)
            expect(result).toBe('?key1=123&key2=456.789')
        })

        it('handles boolean values correctly', () => {
            const data = { key1: true, key2: false }
            const result = helpers.encodeQueryData(data)
            expect(result).toBe('?key1=true')
        })

        it('ignores keys with empty string values', () => {
            const data = { key1: 'value1', key2: '' }
            const result = helpers.encodeQueryData(data)
            expect(result).toBe('?key1=value1')
        })
    })

    describe('makeActiveLink', () => {
        it('returns an empty string if the input link is empty', () => {
            const result = helpers.makeActiveLink('')
            expect(result).toBe('')
        })

        it('returns the link unchanged if it already starts with http://', () => {
            const link = 'http://example.com'
            const result = helpers.makeActiveLink(link)
            expect(result).toBe(link)
        })

        it('returns the link unchanged if it already starts with https://', () => {
            const link = 'https://example.com'
            const result = helpers.makeActiveLink(link)
            expect(result).toBe(link)
        })

        it('prepends https:// to the link if it does not start with http:// or https://', () => {
            const link = 'example.com'
            const result = helpers.makeActiveLink(link)
            expect(result).toBe('https://example.com')
        })

        it('handles links with special characters correctly', () => {
            const link = 'example.com/path?query=string#hash'
            const result = helpers.makeActiveLink(link)
            expect(result).toBe('https://example.com/path?query=string#hash')
        })

        it('prepends https:// to a link with www.', () => {
            const link = 'www.example.com'
            const result = helpers.makeActiveLink(link)
            expect(result).toBe('https://www.example.com')
        })

        it('does not modify a link that is already complete with https:// and additional paths/queries', () => {
            const link = 'https://www.example.com/path?query=string#hash'
            const result = helpers.makeActiveLink(link)
            expect(result).toBe(link)
        })

        it('does not modify a link that is already complete with http:// and additional paths/queries', () => {
            const link = 'http://www.example.com/path?query=string#hash'
            const result = helpers.makeActiveLink(link)
            expect(result).toBe(link)
        })
    })

    describe('equalsArrays', () => {
        it('returns true if both arrays are undefined or empty', () => {
            expect(helpers.equalsArrays(undefined, undefined)).toBe(true)
            expect(helpers.equalsArrays([], [])).toBe(true)
            expect(helpers.equalsArrays(undefined, [])).toBe(true)
            expect(helpers.equalsArrays([], undefined)).toBe(true)
        })

        it('returns false if one array is empty or undefined and the other is not', () => {
            expect(helpers.equalsArrays(['a'], undefined)).toBe(false)
            expect(helpers.equalsArrays(undefined, ['a'])).toBe(false)
            expect(helpers.equalsArrays(['a'], [])).toBe(false)
            expect(helpers.equalsArrays([], ['a'])).toBe(false)
        })

        it('returns true if both arrays contain the same elements in the same order', () => {
            expect(helpers.equalsArrays(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(true)
        })

        it('returns true if both arrays contain the same elements in different orders', () => {
            expect(helpers.equalsArrays(['a', 'b', 'c'], ['c', 'b', 'a'])).toBe(true)
        })

        it('returns false if arrays contain different elements', () => {
            expect(helpers.equalsArrays(['a', 'b', 'c'], ['a', 'b', 'd'])).toBe(false)
            expect(helpers.equalsArrays(['a', 'b', 'c'], ['a', 'b'])).toBe(false)
        })

        it('returns false if arrays contain the same elements with different lengths', () => {
            expect(helpers.equalsArrays(['a', 'b', 'c'], ['a', 'b', 'c', 'd'])).toBe(false)
        })

        it('returns false if arrays contain duplicate elements in one array but not the other', () => {
            expect(helpers.equalsArrays(['a', 'b', 'c'], ['a', 'a', 'b', 'c'])).toBe(false)
        })

        it('returns true for arrays with different references but same content', () => {
            const array1 = ['a', 'b', 'c']
            const array2 = ['a', 'b', 'c']
            expect(helpers.equalsArrays(array1, array2)).toBe(true)
        })
    })

    describe('removeProtocolFromUrl', () => {
        it('removes http protocol from url', () => {
            expect(helpers.removeProtocolFromUrl('http://example.com')).toBe('example.com')
            expect(helpers.removeProtocolFromUrl('http://www.example.com')).toBe('www.example.com')
        })

        it('removes https protocol from url', () => {
            expect(helpers.removeProtocolFromUrl('https://example.com')).toBe('example.com')
            expect(helpers.removeProtocolFromUrl('https://www.example.com')).toBe('www.example.com')
        })

        it('does not alter urls without http or https protocol', () => {
            expect(helpers.removeProtocolFromUrl('ftp://example.com')).toBe('ftp://example.com')
            expect(helpers.removeProtocolFromUrl('www.example.com')).toBe('www.example.com')
            expect(helpers.removeProtocolFromUrl('example.com')).toBe('example.com')
        })

        it('handles urls with mixed case protocols', () => {
            expect(helpers.removeProtocolFromUrl('Http://example.com')).toBe('Http://example.com')
            expect(helpers.removeProtocolFromUrl('Https://example.com')).toBe('Https://example.com')
        })

        it('does not alter an empty string', () => {
            expect(helpers.removeProtocolFromUrl('')).toBe('')
        })

        it('removes protocol from urls with paths and queries', () => {
            expect(helpers.removeProtocolFromUrl('https://example.com/path?query=1')).toBe('example.com/path?query=1')
            expect(helpers.removeProtocolFromUrl('http://example.com/path?query=1')).toBe('example.com/path?query=1')
        })
    })

    describe('numberFormatter', () => {
        it('formats numbers less than 1000 without a suffix', () => {
            expect(helpers.numberFormatter(0)).toBe(0)
            expect(helpers.numberFormatter(123)).toBe('123')
            expect(helpers.numberFormatter(999)).toBe('999')
        })

        it('formats numbers in thousands with "k" suffix', () => {
            expect(helpers.numberFormatter(1000)).toBe('1k')
            expect(helpers.numberFormatter(1500)).toBe('1.5k')
            expect(helpers.numberFormatter(999999)).toBe('1000k')
        })

        it('formats numbers in millions with "M" suffix', () => {
            expect(helpers.numberFormatter(1e6)).toBe('1M')
            expect(helpers.numberFormatter(2.5e6)).toBe('2.5M')
            expect(helpers.numberFormatter(999999999)).toBe('1000M')
        })

        it('formats numbers in billions with "G" suffix', () => {
            expect(helpers.numberFormatter(1e9)).toBe('1G')
            expect(helpers.numberFormatter(2.5e9)).toBe('2.5G')
            expect(helpers.numberFormatter(999999999999)).toBe('1000G')
        })

        it('formats numbers in trillions with "T" suffix', () => {
            expect(helpers.numberFormatter(1e12)).toBe('1T')
            expect(helpers.numberFormatter(2.5e12)).toBe('2.5T')
            expect(helpers.numberFormatter(999999999999999)).toBe('1000T')
        })

        it('formats numbers in quadrillions with "P" suffix', () => {
            expect(helpers.numberFormatter(1e15)).toBe('1P')
            expect(helpers.numberFormatter(2.5e15)).toBe('2.5P')
        })

        it('formats numbers in quintillions with "E" suffix', () => {
            expect(helpers.numberFormatter(1e18)).toBe('1E')
            expect(helpers.numberFormatter(2.5e18)).toBe('2.5E')
        })

        it('formats numbers with custom digits', () => {
            expect(helpers.numberFormatter(1500, 2)).toBe('1.5k')
            expect(helpers.numberFormatter(2.5e6, 3)).toBe('2.5M')
            expect(helpers.numberFormatter(2.5e18, 0)).toBe('2.5E')
        })

        it('handles edge cases', () => {
            expect(helpers.numberFormatter(0.123)).toBe(0.123)
            expect(helpers.numberFormatter(0.999)).toBe(0.999)
            expect(helpers.numberFormatter(1)).toBe('1')
        })

        it('returns the original number if less than 1', () => {
            expect(helpers.numberFormatter(0.5)).toBe(0.5)
            expect(helpers.numberFormatter(0)).toBe(0)
        })
    })

    describe('ratingColor', () => {
        it('returns "red" for values less than or equal to 1', () => {
            expect(helpers.ratingColor(0)).toBe('red')
            expect(helpers.ratingColor(1)).toBe('red')
            expect(helpers.ratingColor(0.5)).toBe('red')
        })

        it('returns "orange" for values greater than 1 and less than 3', () => {
            expect(helpers.ratingColor(1.1)).toBe('orange')
            expect(helpers.ratingColor(2)).toBe('orange')
            expect(helpers.ratingColor(2.9)).toBe('orange')
        })

        it('returns "green" for values greater than or equal to 3', () => {
            expect(helpers.ratingColor(3)).toBe('green')
            expect(helpers.ratingColor(4)).toBe('green')
            expect(helpers.ratingColor(5)).toBe('green')
        })

        it('does not return "gray" for any valid input', () => {
            expect(helpers.ratingColor(0)).not.toBe('gray')
            expect(helpers.ratingColor(1)).not.toBe('gray')
            expect(helpers.ratingColor(2)).not.toBe('gray')
            expect(helpers.ratingColor(3)).not.toBe('gray')
        })

        it('handles boundary values correctly', () => {
            expect(helpers.ratingColor(1)).toBe('red')
            expect(helpers.ratingColor(2.999)).toBe('orange')
            expect(helpers.ratingColor(3)).toBe('green')
        })
    })

    describe('isValidJSON', () => {
        it('returns true for valid JSON strings', () => {
            expect(helpers.isValidJSON(null as unknown as string)).toBe(true)
            expect(helpers.isValidJSON('{"name": "John", "age": 30, "city": "New York"}')).toBe(true)
            expect(helpers.isValidJSON('["apple", "banana", "cherry"]')).toBe(true)
            expect(helpers.isValidJSON('{"numbers": [1, 2, 3, 4, 5]}')).toBe(true)
            expect(helpers.isValidJSON('true')).toBe(true)
            expect(helpers.isValidJSON('null')).toBe(true)
            expect(helpers.isValidJSON('"string"')).toBe(true)
            expect(helpers.isValidJSON('123')).toBe(true)
        })

        it('returns false for invalid JSON strings', () => {
            expect(helpers.isValidJSON('{"name": "John", "age": 30, "city": "New York"')).toBe(false) // missing closing brace
            expect(helpers.isValidJSON('["apple", "banana", "cherry"')).toBe(false) // missing closing bracket
            expect(helpers.isValidJSON('{"numbers": [1, 2, 3, 4, 5]')).toBe(false) // missing closing brace
            expect(helpers.isValidJSON('undefined')).toBe(false) // not a valid JSON value
            expect(helpers.isValidJSON('truefalse')).toBe(false) // not a valid JSON value
            expect(helpers.isValidJSON('{name: "John", age: 30, city: "New York"}')).toBe(false) // keys must be double-quoted
        })
    })

    describe('removeMarkdown', () => {
        it('returns empty string for undefined input', () => {
            expect(helpers.removeMarkdown(undefined)).toBe('')
        })

        it('strips bold markdown', () => {
            expect(helpers.removeMarkdown('**bold text**')).toBe('bold text')
        })

        it('strips inline code', () => {
            expect(helpers.removeMarkdown('`code snippet`')).toBe('code snippet')
        })

        it('strips strikethrough', () => {
            expect(helpers.removeMarkdown('~~strikethrough~~')).toBe('strikethrough')
        })

        // The link regex \[([^\]]+)\]\([^)]+\) does correctly strip Markdown links.
        // Documenting current behaviour: the text inside [] is returned and the URL is removed.
        it('strips Markdown link syntax and returns the link text (current behaviour)', () => {
            expect(helpers.removeMarkdown('[link text](https://example.com)')).toBe('link text')
        })

        // The image regex runs after the link regex, so the link regex first strips [alt text](url)
        // leaving a leading '!' which is not part of the captured group. The image regex then
        // no longer matches the remaining '!alt text', so the '!' is left in the output.
        // Documenting current (broken) behaviour: the link regex partially processes the image
        // before the image regex can run, resulting in '!' + alt text being returned.
        it('image syntax: link regex runs first, leaving a leading ! in the output (current broken behaviour)', () => {
            expect(helpers.removeMarkdown('![alt text](https://example.com/img.png)')).toBe('!alt text')
        })

        // Empty alt: link regex requires [^\]]+ (1+ chars) so it skips []; image regex uses [^\]]* (0+)
        // and correctly matches, replacing with empty string.
        it('image with empty alt: image regex matches and returns empty string (current behaviour)', () => {
            expect(helpers.removeMarkdown('![](https://example.com/img.png)')).toBe('')
        })
    })

    describe('addDecimalPoint', () => {
        it('adds .0 to integers', () => {
            expect(helpers.addDecimalPoint(123)).toBe('123.0')
            expect(helpers.addDecimalPoint('456')).toBe('456.0')
            expect(helpers.addDecimalPoint('789.')).toBe('789.0')
        })

        it('adds . to non-integer strings without decimal point', () => {
            expect(helpers.addDecimalPoint('123')).toBe('123.0')
            expect(helpers.addDecimalPoint('456.')).toBe('456.0')
        })

        it('returns input with trailing .0 if it already contains a decimal point but no digits after it', () => {
            expect(helpers.addDecimalPoint('789.')).toBe('789.0')
        })

        it('returns input as is if it already contains a decimal point and digits after it', () => {
            expect(helpers.addDecimalPoint('123.45')).toBe('123.45')
            expect(helpers.addDecimalPoint(678.9)).toBe('678.9')
        })

        it('returns empty string for undefined or empty input', () => {
            expect(helpers.addDecimalPoint(undefined)).toBe('')
            expect(helpers.addDecimalPoint('')).toBe('')
        })
    })
})
