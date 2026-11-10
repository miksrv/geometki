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

    it('does nothing when no field with an error is on the page', () => {
        expect(scrollToFirstError({ email: { type: 'server' } } as never)).toBe(false)
    })
})
