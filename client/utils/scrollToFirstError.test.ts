import { errorFieldNames, scrollToFirstError } from './scrollToFirstError'

describe('errorFieldNames', () => {
    it('lists the leaf errors with dotted names', () => {
        expect(
            errorFieldNames({
                name: { type: 'required', message: 'Required' },
                settings: { emailPlace: { type: 'server', message: 'Bad' } },
                photos: [undefined, { title: { type: 'maxLength' } }]
            } as never)
        ).toStrictEqual(['name', 'settings.emailPlace', 'photos.1.title'])
    })

    it('is empty without errors', () => {
        expect(errorFieldNames(undefined)).toStrictEqual([])
    })
})

describe('scrollToFirstError', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <input name="name" />
            <input name="website" />
            <input name="newPassword" />
        `
    })

    it('scrolls to and focuses the first field in the page order', () => {
        const scrollIntoView = jest.fn()
        Element.prototype.scrollIntoView = scrollIntoView

        const found = scrollToFirstError({
            newPassword: { type: 'required' },
            website: { type: 'pattern' }
        } as never)

        expect(found).toBe(true)
        expect(document.activeElement).toBe(document.querySelector('[name="website"]'))
        expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: 'center' }))
    })

    it('finds a field without an input by data-field and focuses what is inside it', () => {
        Element.prototype.scrollIntoView = jest.fn()
        document.body.innerHTML = `
            <div data-field="category"><button type="button">Категория</button></div>
            <div data-field="lat lon"></div>
            <input name="title" />
        `

        expect(scrollToFirstError({ lon: { type: 'server' }, title: { type: 'required' } } as never)).toBe(true)
        expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1)
        expect(document.activeElement).toBe(document.body)

        scrollToFirstError({ category: { type: 'required' }, title: { type: 'required' } } as never)
        expect(document.activeElement).toBe(document.querySelector('button'))
    })

    it('does nothing when no field with an error is on the page', () => {
        expect(scrollToFirstError({ email: { type: 'server' } } as never)).toBe(false)
    })
})
