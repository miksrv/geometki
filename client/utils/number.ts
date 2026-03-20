export const numberFormatter = (num: number, digits?: number) => {
    const lookup = [
        { symbol: '', value: 1 },
        { symbol: 'k', value: 1e3 },
        { symbol: 'M', value: 1e6 },
        { symbol: 'G', value: 1e9 },
        { symbol: 'T', value: 1e12 },
        { symbol: 'P', value: 1e15 },
        { symbol: 'E', value: 1e18 }
    ]

    if (num < 1) {
        return num
    }

    const rx = /\.0+$|(\.[0-9]*[1-9])0+$/
    const item = lookup
        .slice()
        .reverse()
        .find((item) => num >= item.value)

    return item ? (num / item.value).toFixed(digits || 1).replace(rx, '$1') + item.symbol : '0'
}

export const round = (value?: number, digits: number = 4): number | undefined =>
    value ? Number(value.toFixed(digits)) : undefined

export const ratingColor = (value: number): 'green' | 'orange' | 'gray' | 'red' =>
    value <= 1 ? 'red' : value > 1 && value < 3 ? 'orange' : value >= 3 ? 'green' : 'gray'

export const addDecimalPoint = (input: number | string | undefined): string => {
    if (!input) {
        return ''
    }

    const inputValue: string = typeof input === 'number' ? input.toString() : input

    if (inputValue.includes('.')) {
        const [integerPart, decimalPart] = inputValue.split('.')
        if (decimalPart === '') {
            return `${integerPart}.0`
        }

        return inputValue
    }
    return `${inputValue}.0`
}
