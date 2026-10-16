import { splitByMatch } from './highlight'

const marked = (text: string, query: string) =>
    splitByMatch(text, query)
        .map((part) => (part.match ? `[${part.text}]` : part.text))
        .join('')

describe('splitByMatch', () => {
    it('marks every occurrence of the query, ignoring the case', () => {
        expect(marked('Оренбург и Оренбургская область', 'оренб')).toBe('[Оренб]ург и [Оренб]ургская область')
    })

    it('marks each word of the query, the longer word first', () => {
        expect(marked('Змеиная гора (Оренбург)', 'гора оренбург')).toBe('Змеиная [гора] ([Оренбург])')
    })

    it('matches "ё" and "е" both ways', () => {
        expect(marked('Озёрный', 'озер')).toBe('[Озёр]ный')
        expect(marked('Озерный', 'озёр')).toBe('[Озер]ный')
    })

    it('treats the query as text, not a pattern', () => {
        expect(marked('51.76, 55.10', '51.76')).toBe('[51.76], 55.10')
        expect(marked('a+b', 'a+')).toBe('[a+]b')
    })

    it('leaves the text whole without words of two letters', () => {
        expect(splitByMatch('Казань', 'к')).toStrictEqual([{ match: false, text: 'Казань' }])
        expect(splitByMatch('', 'казань')).toStrictEqual([])
    })
})
