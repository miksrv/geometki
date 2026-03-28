import React from 'react'
import { Provider } from 'react-redux'

import { configureStore } from '@reduxjs/toolkit'
import { fireEvent, render, screen } from '@testing-library/react'

import { API } from '@/api'
import applicationReducer from '@/app/applicationSlice'
import authReducer from '@/app/authSlice'
import notificationReducer from '@/app/notificationSlice'

import { BookmarkButton } from './BookmarkButton'

jest.mock('simple-react-ui-kit', () => ({
    Button: ({ icon, disabled, loading, onClick, mode, className, children }: any) => (
        <button
            data-icon={icon}
            data-mode={mode}
            disabled={disabled || loading}
            className={className}
            onClick={onClick}
        >
            {children}
        </button>
    )
}))

jest.mock('next-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key
    })
}))

jest.mock('@/utils/localstorage', () => ({
    getItem: jest.fn().mockReturnValue(null),
    setItem: jest.fn(),
    removeItem: jest.fn()
}))

jest.mock('../../../next-i18next.config', () => ({
    i18n: { defaultLocale: 'ru' }
}))

jest.mock('cookies-next', () => ({
    getCookie: jest.fn().mockReturnValue(''),
    setCookie: jest.fn(),
    deleteCookie: jest.fn()
}))

jest.mock('@/api', () => ({
    API: {
        useBookmarksPutPlaceMutation: jest.fn().mockReturnValue([jest.fn(), { isLoading: false }]),
        useBookmarksGetPlaceQuery: jest
            .fn()
            .mockReturnValue({ data: { result: false }, isLoading: false, isFetching: false })
    }
}))

jest.mock('@/utils/api', () => ({
    getErrorMessage: jest.fn().mockReturnValue('Error message')
}))

jest.mock('@/config/constants', () => ({
    LOCAL_STORAGE: {
        RETURN_PATH: 'returnPath',
        LOCALE: 'locale',
        THEME: 'theme',
        LOCATION: 'location',
        MAP_CENTER: 'mapCenter'
    },
    AUTH_COOKIES: { SESSION: 'session', TOKEN: 'token' }
}))

const makeStore = (preloadedState?: Record<string, unknown>) =>
    configureStore({
        reducer: {
            application: applicationReducer,
            auth: authReducer,
            notification: notificationReducer
        },
        preloadedState
    })

const renderWithStore = (ui: React.ReactElement, preloadedState?: Record<string, unknown>) => {
    const store = makeStore(preloadedState)
    return render(<Provider store={store}>{ui}</Provider>)
}

describe('BookmarkButton', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.mocked(API.useBookmarksGetPlaceQuery).mockReturnValue({
            data: { result: false },
            isLoading: false,
            isFetching: false
        })
        jest.mocked(API.useBookmarksPutPlaceMutation).mockReturnValue([jest.fn(), { isLoading: false }])
    })

    describe('rendering', () => {
        it('renders a button', () => {
            renderWithStore(<BookmarkButton placeId={'place-1'} />)
            expect(screen.getByRole('button')).toBeInTheDocument()
        })

        it('renders with HeartEmpty icon when not bookmarked', () => {
            renderWithStore(<BookmarkButton placeId={'place-1'} />)
            expect(screen.getByRole('button')).toHaveAttribute('data-icon', 'HeartEmpty')
        })

        it('renders with HeartFilled icon when bookmarked', () => {
            jest.mocked(API.useBookmarksGetPlaceQuery).mockReturnValue({
                data: { result: true },
                isLoading: false,
                isFetching: false
            })

            renderWithStore(<BookmarkButton placeId={'place-1'} />)
            expect(screen.getByRole('button')).toHaveAttribute('data-icon', 'HeartFilled')
        })

        it('is disabled when no placeId is provided', () => {
            renderWithStore(<BookmarkButton />)
            expect(screen.getByRole('button')).toBeDisabled()
        })
    })

    describe('unauthenticated user', () => {
        it('dispatches openAuthDialog when clicked and not authenticated', () => {
            const store = makeStore({
                auth: { isAuth: false, user: undefined }
            })
            const dispatchSpy = jest.spyOn(store, 'dispatch')

            render(
                <Provider store={store}>
                    <BookmarkButton placeId={'place-1'} />
                </Provider>
            )
            fireEvent.click(screen.getByRole('button'))

            expect(dispatchSpy).toHaveBeenCalled()
        })
    })

    describe('authenticated user', () => {
        it('calls setBookmark when clicked while authenticated', async () => {
            const mockSetBookmark = jest.fn().mockResolvedValue({ data: {} })
            jest.mocked(API.useBookmarksPutPlaceMutation).mockReturnValue([mockSetBookmark, { isLoading: false }])
            jest.mocked(API.useBookmarksGetPlaceQuery).mockReturnValue({
                data: { result: false },
                isLoading: false,
                isFetching: false
            })

            renderWithStore(<BookmarkButton placeId={'place-1'} />, {
                auth: { isAuth: true, user: { id: 'u1', name: 'Alice' } }
            })
            fireEvent.click(screen.getByRole('button'))

            await Promise.resolve()
            expect(mockSetBookmark).toHaveBeenCalledWith({ placeId: 'place-1' })
        })
    })
})
