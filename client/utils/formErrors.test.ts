import { parseServerErrors } from './formErrors'

describe('parseServerErrors', () => {
    it('puts the messages of the known fields under them and the rest at the top', () => {
        expect(
            parseServerErrors({ messages: { ends_on: 'Too early', error: 'Nope', kind: 'Bad kind' } }, [
                'starts_on',
                'ends_on'
            ])
        ).toEqual({ fields: { ends_on: 'Too early' }, message: 'Nope Bad kind' })
    })

    it('takes the plain message of an answer of another shape', () => {
        expect(parseServerErrors('Server is down', ['id'])).toEqual({ fields: {}, message: 'Server is down' })
    })
})
