import React from 'react'
import { Provider } from 'react-redux'

import { configureStore } from '@reduxjs/toolkit'
import { act, fireEvent, render, screen } from '@testing-library/react'

import applicationReducer from '@/app/applicationSlice'
import authReducer from '@/app/authSlice'
import notificationReducer from '@/app/notificationSlice'
import { localPlainDate } from '@/utils/date'

import { PlaceVisitQuestions } from './PlaceVisitQuestions'

jest.mock('@/utils/localstorage', () => ({ getItem: jest.fn(), removeItem: jest.fn(), setItem: jest.fn() }))
jest.mock('../../../next-i18next.config', () => ({ i18n: { defaultLocale: 'ru' } }))
jest.mock('cookies-next', () => ({ deleteCookie: jest.fn(), getCookie: jest.fn(), setCookie: jest.fn() }))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}))

const mockPatch = jest.fn()
let mockMe: unknown
let mockFetching = false

jest.mock('@/api', () => ({
    API: {
        useVisitsGetMeQuery: () => ({ data: mockMe, isFetching: mockFetching }),
        useVisitsPatchMutation: () => [mockPatch]
    },
    ApiModel: {},
    ApiType: {}
}))

const questions = [
    { key: 'road', values: ['asphalt', 'dirt'] },
    { key: 'entry', values: ['free', 'paid'] }
]

const withFeatures = [...questions, { features: ['swim', 'fish'], key: 'can' }]

const renderBlock = (props: Partial<React.ComponentProps<typeof PlaceVisitQuestions>> = {}) => {
    const store = configureStore({
        preloadedState: { auth: { isAuth: true } as never },
        reducer: { application: applicationReducer, auth: authReducer, notification: notificationReducer }
    })

    const result = render(
        <Provider store={store}>
            <PlaceVisitQuestions
                placeId={'p1'}
                {...props}
            />
        </Provider>
    )

    return { ...result, store }
}

describe('PlaceVisitQuestions', () => {
    beforeEach(() => {
        localStorage.clear()
        mockFetching = false
        mockPatch.mockReset()
        mockPatch.mockReturnValue({ unwrap: () => Promise.resolve({}) })
    })

    describe('in the bottom sheet', () => {
        const today = () => ({ count: 1, items: [{ id: 'v1', visitedAt: localPlainDate(0) }], questions: withFeatures })

        it('waits while the visits are asked again, then asks', () => {
            const onFinish = jest.fn()
            mockMe = { count: 0, items: [], questions }
            mockFetching = true

            const { rerender, store } = renderBlock({ onFinish, variant: 'sheet' })

            expect(onFinish).not.toHaveBeenCalled()

            mockMe = today()
            mockFetching = false
            rerender(
                <Provider store={store}>
                    <PlaceVisitQuestions
                        placeId={'p1'}
                        variant={'sheet'}
                        onFinish={onFinish}
                    />
                </Provider>
            )

            expect(screen.getByText('visitQuestions.road.question')).toBeInTheDocument()
            expect(onFinish).not.toHaveBeenCalled()
        })

        it('ends when there is nothing to ask', () => {
            const onAsk = jest.fn()
            const onFinish = jest.fn()
            mockMe = { count: 0, items: [], questions }

            renderBlock({ onAsk, onFinish, variant: 'sheet' })

            expect(onFinish).toHaveBeenCalledTimes(1)
            expect(onFinish).toHaveBeenCalledWith('nothing')
            expect(onAsk).not.toHaveBeenCalled()
        })

        it('says when it has a question, so the sheet opens only then', () => {
            const onAsk = jest.fn()
            mockMe = today()

            renderBlock({ onAsk, variant: 'sheet' })

            expect(onAsk).toHaveBeenCalled()
        })

        it('ends on "Пропустить" and keeps the visit skipped', () => {
            const onFinish = jest.fn()
            mockMe = today()

            renderBlock({ onFinish, variant: 'sheet' })
            fireEvent.click(screen.getByText('visit-questions-skip'))

            expect(onFinish).toHaveBeenCalledTimes(1)
            expect(onFinish).toHaveBeenCalledWith('ended')
            expect(JSON.parse(localStorage.getItem('visit_questions_skipped') ?? '[]')).toStrictEqual(['v1'])
        })

        it('ends on "Готово" with the thanks as a toast', () => {
            const onFinish = jest.fn()
            mockMe = {
                count: 1,
                items: [{ answers: { entry: 'free', road: 'dirt' }, id: 'v1', visitedAt: localPlainDate(0) }],
                questions: withFeatures
            }

            const { store } = renderBlock({ onFinish, variant: 'sheet' })

            expect(screen.getByText('visitQuestions.can.question')).toBeInTheDocument()

            fireEvent.click(screen.getByText('visit-questions-done'))

            expect(onFinish).toHaveBeenCalledTimes(1)
            expect(onFinish).toHaveBeenCalledWith('ended')
            expect(screen.queryByText('visit-questions-thanks')).not.toBeInTheDocument()
            expect(store.getState().notification.list.map((item) => item.message)).toContain('visit-questions-thanks')
        })
    })

    it('asks the first unanswered question of the latest visit of today and sends the answer', () => {
        mockMe = {
            count: 2,
            items: [
                { id: 'v1', visitedAt: localPlainDate(-1) },
                { id: 'v2', visitedAt: localPlainDate(0) }
            ],
            questions
        }

        renderBlock()

        expect(screen.getByText('visitQuestions.road.question')).toBeInTheDocument()

        jest.useFakeTimers()
        fireEvent.click(screen.getByText('visitQuestions.road.values.dirt'))

        // The next question comes at once, the answer goes after a pause
        expect(screen.getByText('visitQuestions.entry.question')).toBeInTheDocument()
        expect(mockPatch).not.toHaveBeenCalled()

        act(() => jest.advanceTimersByTime(4000))
        expect(mockPatch).toHaveBeenCalledWith({ answers: { road: 'dirt' }, id: 'v2', place: 'p1' })
        jest.useRealTimers()
    })

    it('sends the answers of a few taps in one request, at once when the questions end', () => {
        mockMe = { count: 1, items: [{ id: 'v1', visitedAt: localPlainDate(0) }], questions }

        renderBlock()

        fireEvent.click(screen.getByText('visitQuestions.road.values.dirt'))
        fireEvent.click(screen.getByText('visitQuestions.entry.values.paid'))

        expect(screen.getByText('visit-questions-thanks')).toBeInTheDocument()
        expect(mockPatch).toHaveBeenCalledTimes(1)
        expect(mockPatch).toHaveBeenCalledWith({ answers: { entry: 'paid', road: 'dirt' }, id: 'v1', place: 'p1' })
    })

    it('asks again what the server refused to save', async () => {
        mockMe = { count: 1, items: [{ id: 'v1', visitedAt: localPlainDate(0) }], questions }
        mockPatch.mockReturnValue({ unwrap: () => Promise.reject(new Error('no')) })
        jest.useFakeTimers()

        const { store } = renderBlock()

        fireEvent.click(screen.getByText('visitQuestions.road.values.dirt'))
        expect(screen.getByText('visitQuestions.entry.question')).toBeInTheDocument()

        await act(async () => {
            jest.advanceTimersByTime(4000)
        })

        expect(mockPatch).toHaveBeenCalledTimes(1)
        expect(screen.getByText('visitQuestions.road.question')).toBeInTheDocument()
        expect(store.getState().notification.list).toHaveLength(1)
        jest.useRealTimers()
    })

    it('leaves out the questions and values the catalogue does not know', () => {
        mockMe = {
            count: 1,
            items: [{ id: 'v1', visitedAt: localPlainDate(0) }],
            questions: [
                { key: 'sunset', values: ['red'] },
                { key: 'road', values: ['asphalt', 'lava'] }
            ]
        }

        renderBlock()

        expect(screen.queryByText('visitQuestions.sunset.question')).not.toBeInTheDocument()
        expect(screen.getByText('visitQuestions.road.question')).toBeInTheDocument()
        expect(screen.getByText('visitQuestions.road.values.asphalt')).toBeInTheDocument()
        expect(screen.queryByText('visitQuestions.road.values.lava')).not.toBeInTheDocument()
    })

    it('asks about an old visit that has no answers', () => {
        mockMe = { count: 1, items: [{ id: 'v1', visitedAt: '2023-05-14' }], questions }

        renderBlock()

        expect(screen.getByText('visitQuestions.road.question')).toBeInTheDocument()
    })

    it('shows nothing when every question is answered', () => {
        mockMe = {
            count: 1,
            items: [{ answers: { entry: 'free', road: 'dirt' }, id: 'v1', visitedAt: localPlainDate(0) }],
            questions
        }

        const { container } = renderBlock()

        expect(container).toBeEmptyDOMElement()
    })

    it('hides the block on "Пропустить"', () => {
        mockMe = { count: 1, items: [{ id: 'v1', visitedAt: localPlainDate(0) }], questions }

        const { container } = renderBlock()

        fireEvent.click(screen.getByText('visit-questions-skip'))

        expect(container).toBeEmptyDOMElement()
        expect(JSON.parse(localStorage.getItem('visit_questions_skipped') ?? '[]')).toEqual(['v1'])
    })

    describe('features', () => {
        const answered = { entry: 'free', road: 'dirt' }

        beforeEach(() => {
            mockMe = {
                count: 1,
                items: [{ answers: answered, id: 'v1', visitedAt: localPlainDate(0) }],
                questions: withFeatures
            }
        })

        it('asks what can be done after the ordinary questions, three states by taps', () => {
            renderBlock()

            expect(screen.getByText('visitQuestions.can.question')).toBeInTheDocument()
            expect(screen.getByText('visit-questions-done')).toBeInTheDocument()
            expect(screen.queryByText('visit-questions-skip')).not.toBeInTheDocument()

            // The first chip, swim: its name tells the state once answered
            const chip = () => screen.getAllByRole('button')[0]

            expect(chip()).toHaveAttribute('aria-pressed', 'false')
            expect(chip()).toHaveAccessibleName('visitFeatures.swim')

            fireEvent.click(chip())
            expect(chip()).toHaveAttribute('aria-pressed', 'true')
            expect(chip()).toHaveAccessibleName('visit-feature-can')

            fireEvent.click(chip())
            expect(chip()).toHaveAttribute('aria-pressed', 'false')
            expect(chip()).toHaveAccessibleName('visit-feature-cannot')

            fireEvent.click(screen.getAllByRole('button')[1])

            fireEvent.click(chip())
            expect(chip()).toHaveAttribute('aria-pressed', 'false')

            // All the taps in one request, sent by "Готово"
            expect(mockPatch).not.toHaveBeenCalled()
            fireEvent.click(screen.getByText('visit-questions-done'))
            expect(mockPatch).toHaveBeenCalledTimes(1)
            expect(mockPatch).toHaveBeenCalledWith({
                answers: { can_fish: 'yes', can_swim: null },
                id: 'v1',
                place: 'p1'
            })
        })

        it('ends the block on "Готово" with a thanks line', () => {
            renderBlock()

            fireEvent.click(screen.getByText('visit-questions-done'))

            expect(screen.getByText('visit-questions-thanks')).toBeInTheDocument()
            expect(screen.queryByText('visitQuestions.can.question')).not.toBeInTheDocument()
        })

        it('is done when the visit already has a feature answer', () => {
            mockMe = {
                count: 1,
                items: [{ answers: { ...answered, can_swim: 'yes' }, id: 'v1', visitedAt: localPlainDate(0) }],
                questions: withFeatures
            }

            const { container } = renderBlock()

            expect(container).toBeEmptyDOMElement()
        })
    })
})
