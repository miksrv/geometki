// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const encodeQueryData = (data: any): string => {
    if (typeof data === 'undefined' || !data) {
        return ''
    }

    const ret = []

    for (const d in data) {
        if (d && data[d]) {
            ret.push(encodeURIComponent(d) + '=' + encodeURIComponent(data[d]))
        }
    }

    return ret.length ? '?' + ret.join('&') : ''
}

export const makeActiveLink = (link: string) => {
    if (link === '') {
        return ''
    }

    if (link.includes('http://') || link.includes('https://')) {
        return link
    }
    return `https://${link}`
}

export const removeProtocolFromUrl = (url: string): string => url.replace(/^https?:\/\//, '')
