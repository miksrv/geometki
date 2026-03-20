export const truncateText = (text?: string, maxLength: number = 300) => {
    if (!text || text.length <= maxLength) {
        return text
    }

    const lastSpaceIndex = text.lastIndexOf(' ', maxLength)

    if (lastSpaceIndex === -1) {
        return text.slice(0, maxLength)
    }

    return text.slice(0, lastSpaceIndex)
}

/**
 * Removed markdown from text
 * @param text
 */
export const removeMarkdown = (text?: string): string => {
    if (!text) {
        return ''
    }

    // Remove headers
    let cleanedText = text.replace(/(^|\s)(#{1,6})\s+([^\n]+)/g, '$1$3')
    // Remove bold and italic
    cleanedText = cleanedText.replace(/(\*\*|__)(.*?)\1/g, '$2')
    cleanedText = cleanedText.replace(/(\*\|_)(.*?)\1/g, '$2')
    // Remove strikethrough
    cleanedText = cleanedText.replace(/~~(.*?)~~/g, '$1')
    // Remove inline code
    cleanedText = cleanedText.replace(/`([^`]+)`/g, '$1')
    // Remove links
    cleanedText = cleanedText.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove images
    cleanedText = cleanedText.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Remove blockquotes
    cleanedText = cleanedText.replace(/^\s*>+\s+/gm, '')
    // Remove unordered lists
    cleanedText = cleanedText.replace(/^\s*[-+*]\s+/gm, '')
    // Remove ordered lists
    cleanedText = cleanedText.replace(/^\s*\d+\.\s+/gm, '')
    // Remove horizontal rules
    cleanedText = cleanedText.replace(/^-{3,}\s*$/gm, '')
    // Remove extra line breaks and whitespace
    cleanedText = cleanedText.replace(/\n{2,}/g, '\n').trim()

    return cleanedText
}

export const isValidJSON = (string: string) => {
    if (!string || !string.length) {
        return true
    }

    try {
        JSON.parse(string)
    } catch (e) {
        console.error(e)

        return false
    }

    return true
}
