import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { API } from '@/api'

import { PlaceRatePrompt } from './PlaceRatePrompt'

jest.mock('simple-react-ui-kit', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Button: ({ label, children, onClick }: any) => (
        <button
            type={'button'}
            onClick={onClick}
        >
            {label ?? children}
        </button>
    ),
    cn: (...args: unknown[]) => args.filter(Boolean).join(' ')
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => (opts?.defaultValue as string) ?? key
    })
}))

jest.mock('../place-hero/PlaceHero', () => ({ RATE_ANCHOR: 'rate' }))

jest.mock('@/components/shared', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Rating: ({ value, disabled, onChange }: any) => (
        <button
            type={'button'}
            data-testid={'rating'}
            data-value={value ?? ''}
            disabled={disabled}
            onClick={() => onChange?.(4)}
        >
            stars
        </button>
    )
}))

const mockState = { auth: { user: undefined as { id: string } | undefined } }
const mockDispatch = jest.fn()

jest.mock('@/app/store', () => ({
    useAppDispatch: () => mockDispatch,
    useAppSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState)
}))

jest.mock('@/app/notificationSlice', () => ({ Notify: (payload: unknown) => ({ type: 'notify', payload }) }))
jest.mock('@/utils/api', () => ({ getErrorMessage: () => 'error' }))

const mockChangeRating = jest.fn()

jest.mock('@/api', () => ({
    API: {
        useRatingGetListQuery: jest.fn(),
        useRatingPutScoreMutation: jest.fn()
    }
}))

const useRating = jest.mocked(API.useRatingGetListQuery)
const useMutation = jest.mocked(API.useRatingPutScoreMutation)

describe('PlaceRatePrompt', () => {
    beforeEach(() => {
        mockState.auth.user = undefined
        mockChangeRating.mockReset()
        mockDispatch.mockReset()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        useMutation.mockReturnValue([mockChangeRating, { isLoading: false, isSuccess: false }] as any)
    })

    it('asks a guest to rate with empty stars and sends the score', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        useRating.mockReturnValue({ data: { rating: 4.4, count: 8 } } as any)

        render(<PlaceRatePrompt placeId={'p1'} />)

        expect(screen.getByText('Были здесь?')).toBeInTheDocument()
        expect(screen.getByText('Оцените место')).toBeInTheDocument()

        // The input never shows the average
        const stars = screen.getByTestId('rating')
        expect(stars).toHaveAttribute('data-value', '')

        fireEvent.click(stars)
        expect(mockChangeRating).toHaveBeenCalledWith({ place: 'p1', score: 4 })
    })

    it('shows the own vote with "Изменить" and reopens the input on click', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        useRating.mockReturnValue({ data: { rating: 4.4, count: 8, vote: 5 } } as any)

        render(<PlaceRatePrompt placeId={'p1'} />)

        expect(screen.getByText('Ваша оценка')).toBeInTheDocument()
        expect(screen.getByTestId('rating')).toHaveAttribute('data-value', '5')

        fireEvent.click(screen.getByRole('button', { name: 'Изменить' }))

        expect(screen.getByText('Были здесь?')).toBeInTheDocument()
        expect(screen.getByTestId('rating')).toHaveAttribute('data-value', '')
        expect(screen.getByRole('button', { name: 'cancel' })).toBeInTheDocument()
    })

    it('renders nothing for the author of the place', () => {
        mockState.auth.user = { id: 'u1' }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        useRating.mockReturnValue({ data: { rating: 0, count: 0 } } as any)

        const { container } = render(
            <PlaceRatePrompt
                placeId={'p1'}
                authorId={'u1'}
            />
        )

        expect(container).toBeEmptyDOMElement()
    })
})
