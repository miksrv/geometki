import reducer, { dismissPushPrompt } from './applicationSlice'

const fulfilled = (endpointName: string) => ({
    meta: { arg: { endpointName }, requestStatus: 'fulfilled' },
    payload: {},
    type: 'api/executeMutation/fulfilled'
})

describe('applicationSlice: the push offer', () => {
    it.each(['placesPostItem', 'photoPostUpload', 'ratingPutScore', 'commentsPost'])(
        'is requested after %s',
        (name) => {
            expect(reducer(undefined, fulfilled(name)).pushPromptRequested).toBe(true)
        }
    )

    it('is not requested by other requests', () => {
        expect(reducer(undefined, fulfilled('bookmarksPutPlace')).pushPromptRequested).toBeFalsy()
        expect(
            reducer(undefined, { ...fulfilled('placesPostItem'), type: 'api/executeQuery/fulfilled' })
                .pushPromptRequested
        ).toBeFalsy()
    })

    it('is cleared when dismissed', () => {
        const requested = reducer(undefined, fulfilled('commentsPost'))

        expect(reducer(requested, dismissPushPrompt()).pushPromptRequested).toBe(false)
    })

    it('is dropped on logout, so the next account does not get it', () => {
        const requested = reducer(undefined, fulfilled('photoPostUpload'))

        expect(reducer(requested, { type: 'auth/logout' }).pushPromptRequested).toBe(false)
    })
})
