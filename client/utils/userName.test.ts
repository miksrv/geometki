import { normalizeUserName, USER_NAME_MAX, validateUserName } from './userName'

describe('normalizeUserName', () => {
    it('trims, collapses whitespace and drops invisible characters', () => {
        expect(normalizeUserName('  Иван \t\n Петров  ')).toBe('Иван Петров')
        expect(normalizeUserName('Я​н')).toBe('Ян')
        expect(normalizeUserName('Ян ​ Ли')).toBe('Ян Ли')
        expect(normalizeUserName(undefined)).toBe('')
    })
})

describe('validateUserName', () => {
    it('accepts two-letter and ordinary names', () => {
        expect(validateUserName('Ян')).toBeUndefined()
        expect(validateUserName(' Li ')).toBeUndefined()
        expect(validateUserName('Анна-Мария О’Коннор')).toBeUndefined()
        expect(validateUserName('Ivan Petrov (Vanya)')).toBeUndefined()
    })

    it('leaves an empty name to the required check', () => {
        expect(validateUserName('')).toBeUndefined()
        expect(validateUserName('   ')).toBeUndefined()
    })

    it('refuses names with fewer than two letters or digits', () => {
        expect(validateUserName('.')).toBe('too-short')
        expect(validateUserName('Я')).toBe('too-short')
        expect(validateUserName('- _')).toBe('too-short')
    })

    it('refuses names longer than the limit', () => {
        expect(validateUserName('я'.repeat(USER_NAME_MAX))).toBeUndefined()
        expect(validateUserName('я'.repeat(USER_NAME_MAX + 1))).toBe('too-long')
    })

    it('refuses links, email addresses and symbols', () => {
        expect(validateUserName('ivan@mail.ru')).toBe('invalid-chars')
        expect(validateUserName('https://spam')).toBe('invalid-chars')
        expect(validateUserName('Ivan 🌲')).toBe('invalid-chars')
        expect(validateUserName('<b>Ivan</b>')).toBe('invalid-chars')
    })
})
