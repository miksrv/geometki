/**
 * @jest-environment node
 */
import { loadContent } from './content.server'

jest.mock('react-markdown', () => ({
    __esModule: true,
    // The real parser is an ES module Jest does not load: the file's text is what is checked here
    default: ({ children }: { children: string }) => children
}))

describe('utils/content.server', () => {
    it('reads the page text of the locale', () => {
        expect(loadContent('game-help', 'ru')).toContain('Вся игра за минуту')
        expect(loadContent('game-help', 'en')).toContain('The whole game in a minute')
    })

    it('falls back to the Russian text for a locale without a file', () => {
        expect(loadContent('game-help', 'de')).toContain('Вся игра за минуту')
        expect(loadContent('game-help')).toContain('Вся игра за минуту')
    })

    it('has the same sections in both languages', () => {
        const sections = (locale: string) => loadContent('game-help', locale).match(/^## /gm)?.length

        expect(sections('ru')).toBeGreaterThan(5)
        expect(sections('ru')).toBe(sections('en'))
    })
})
