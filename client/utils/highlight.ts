export interface HighlightPart {
    text: string
    match: boolean
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * The text cut into the parts that match a word of the query and the rest, for `<mark>`ing
 * search suggestions: case-insensitive, "ё" matches "е", words shorter than two letters are
 * ignored, a longer word wins where two overlap.
 */
export const splitByMatch = (text: string, query: string): HighlightPart[] => {
    const words = Array.from(new Set(query.toLowerCase().split(/[\s,]+/)))
        .filter((word) => word.length >= 2)
        .sort((a, b) => b.length - a.length)

    if (!text || !words.length) {
        return text ? [{ match: false, text }] : []
    }

    const pattern = new RegExp(`(${words.map((word) => escapeRegExp(word).replace(/[её]/g, '[её]')).join('|')})`, 'i')

    // A split by a capturing group puts the matches at the odd indexes
    return text
        .split(pattern)
        .map((part, index) => ({ match: index % 2 === 1, text: part }))
        .filter((part) => part.text)
}
