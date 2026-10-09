import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { ExpandableText } from './ExpandableText'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: Array<string | undefined | false | null>) => args.filter(Boolean).join(' ')
}))

const LINE_HEIGHT = 20
const CHARS_PER_LINE = 20

/** jsdom lays nothing out: pretend every 20 characters make one 20px line */
const layoutByLength = () =>
    jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
        return Math.ceil((this.textContent?.length ?? 0) / CHARS_PER_LINE) * LINE_HEIGHT
    })

let narrowScreen = false

// jsdom has no matchMedia
Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({ matches: narrowScreen, media: query }) as MediaQueryList
})

describe('ExpandableText', () => {
    let offsetHeight: jest.SpyInstance
    const realGetComputedStyle = window.getComputedStyle.bind(window)

    beforeEach(() => {
        narrowScreen = false
        offsetHeight = layoutByLength()
        // Keep the real object (testing-library reads it too), only fix the line height
        jest.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) => {
            const style = realGetComputedStyle(el)
            Object.defineProperty(style, 'lineHeight', { configurable: true, value: `${LINE_HEIGHT}px` })

            return style
        })
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    it('renders nothing for an empty text', () => {
        const { container } = render(
            <ExpandableText
                text={''}
                moreLabel={'Подробнее'}
            />
        )
        expect(container).toBeEmptyDOMElement()
    })

    it('shows a text that fits in full, without a control', () => {
        render(
            <ExpandableText
                text={'Короткий текст'}
                lines={2}
                moreLabel={'Подробнее'}
            />
        )

        expect(screen.getByText('Короткий текст')).toBeInTheDocument()
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('cuts a long text at a word so "… Подробнее" ends the last allowed line', () => {
        const text = 'Водопады и каскады горных рек, доступные пешком летом и замерзающие зимой в ледяные стены'

        render(
            <ExpandableText
                text={text}
                lines={2}
                moreLabel={'Подробнее'}
            />
        )

        const paragraph = screen.getByRole('button', { name: 'Подробнее' }).parentElement as HTMLElement
        const shown = paragraph.textContent ?? ''

        expect(shown.length).toBeLessThan(text.length)
        expect(shown).toMatch(/… Подробнее$/)
        // Two lines of 20 characters, including the ellipsis and the control
        expect(shown.length).toBeLessThanOrEqual(2 * CHARS_PER_LINE)
        // The visible prefix is a whole-word prefix of the text
        const prefix = shown.replace(/… Подробнее$/, '')
        expect(text.startsWith(prefix)).toBe(true)
        expect(text.charAt(prefix.length)).toBe(' ')
    })

    it('shows the whole text after the control is clicked', () => {
        const text = 'Водопады и каскады горных рек, доступные пешком летом и замерзающие зимой в ледяные стены'

        render(
            <ExpandableText
                text={text}
                lines={2}
                moreLabel={'Подробнее'}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: 'Подробнее' }))

        expect(screen.getByText(text)).toBeInTheDocument()
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('uses the phone line budget on narrow screens', () => {
        narrowScreen = true
        const text = 'Водопады и каскады горных рек, доступные пешком летом и замерзающие зимой в ледяные стены'

        render(
            <ExpandableText
                text={text}
                lines={3}
                mobileLines={1}
                moreLabel={'Подробнее'}
            />
        )

        const paragraph = screen.getByRole('button', { name: 'Подробнее' }).parentElement as HTMLElement
        expect((paragraph.textContent ?? '').length).toBeLessThanOrEqual(CHARS_PER_LINE)
        expect(offsetHeight).toHaveBeenCalled()
    })
})
