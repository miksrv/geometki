import React from 'react'
import { Provider } from 'react-redux'

import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'

import { API } from '@/api'
import applicationReducer from '@/app/applicationSlice'
import authReducer from '@/app/authSlice'
import notificationReducer from '@/app/notificationSlice'

import { NotificationList } from './NotificationList'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: string[]) => args.filter(Boolean).join(' '),
    Button: ({ label, icon, onClick, disabled, loading, _size, style, children }: any) => (
        <button
            data-icon={icon}
            disabled={disabled || loading}
            style={style}
            onClick={onClick}
        >
            {label ?? children}
        </button>
    ),
    Popout: ({ trigger, children }: any) => (
        <div>
            <div data-testid={'popout-trigger'}>{trigger}</div>
            <div data-testid={'popout-content'}>{children}</div>
        </div>
    ),
    Spinner: () => <div data-testid={'spinner'} />
}))

jest.mock('next-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => opts?.defaultValue ?? key
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
        useNotificationsDeleteMutation: jest.fn().mockReturnValue([jest.fn(), { isLoading: false, isSuccess: false }]),
        useNotificationsGetListQuery: jest
            .fn()
            .mockReturnValue({ data: undefined, isLoading: false, isFetching: false })
    }
}))

jest.mock('@/components/ui', () => ({
    Counter: ({ value }: { value: number }) => <span data-testid={'counter'}>{value}</span>
}))

jest.mock('../snackbar', () => ({
    Notification: ({ message }: { message: string }) => <div data-testid={'notification-item'}>{message}</div>
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

describe('NotificationList', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.mocked(API.useNotificationsGetListQuery).mockReturnValue({
            data: undefined,
            isLoading: false,
            isFetching: false
        })
    })

    describe('rendering', () => {
        it('renders the bell button', () => {
            renderWithStore(<NotificationList />)
            const button = screen.getByRole('button', { name: '' })
            expect(button).toBeInTheDocument()
            expect(button).toHaveAttribute('data-icon', 'Bell')
        })

        it('does not render the counter when unread count is 0', () => {
            renderWithStore(<NotificationList />, {
                notification: { counter: 0, list: [] }
            })
            expect(screen.queryByTestId('counter')).not.toBeInTheDocument()
        })

        it('renders the counter with unread count when counter > 0', () => {
            renderWithStore(<NotificationList />, {
                notification: { counter: 3, list: [] }
            })
            expect(screen.getByTestId('counter')).toHaveTextContent('3')
        })

        it('renders the empty notifications message when no data', () => {
            renderWithStore(<NotificationList />)
            expect(screen.getByText('Нет уведомлений')).toBeInTheDocument()
        })

        it('renders the clear list button', () => {
            renderWithStore(<NotificationList />)
            expect(screen.getByText('Очистить список')).toBeInTheDocument()
        })
    })

    describe('notifications list', () => {
        it('renders notification items when data is available', () => {
            jest.mocked(API.useNotificationsGetListQuery).mockReturnValue({
                data: {
                    items: [
                        { id: 'n1', type: 'success', message: 'First notification', read: false },
                        { id: 'n2', type: 'success', message: 'Second notification', read: true }
                    ],
                    count: 2
                },
                isLoading: false,
                isFetching: false
            })

            renderWithStore(<NotificationList />)
            expect(screen.getAllByTestId('notification-item')).toHaveLength(2)
        })

        it('renders spinner when loading', () => {
            jest.mocked(API.useNotificationsGetListQuery).mockReturnValue({
                data: undefined,
                isLoading: true,
                isFetching: false
            })

            renderWithStore(<NotificationList />)
            expect(screen.getByTestId('spinner')).toBeInTheDocument()
        })
    })
})
