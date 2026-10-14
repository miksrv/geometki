import React from 'react'
import { Provider } from 'react-redux'

import { configureStore } from '@reduxjs/toolkit'
import { act, fireEvent, render, screen } from '@testing-library/react'

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
    Popout: ({ trigger, children, onOpenChange }: any) => (
        <div>
            <div
                data-testid={'popout-trigger'}
                onClick={() => onOpenChange?.(true)}
            >
                {trigger}
            </div>
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

const mockMarkRead = jest.fn()
const mockClear = jest.fn()

jest.mock('@/api', () => ({
    API: {
        useNotificationsDeleteMutation: jest.fn(() => [mockClear, { isLoading: false }]),
        useNotificationsGetListInfiniteQuery: jest.fn(),
        useNotificationsGetUpdatesQuery: jest.fn().mockReturnValue({ data: undefined }),
        useNotificationsPatchReadMutation: jest.fn(() => [mockMarkRead])
    }
}))

jest.mock('@/components/ui', () => ({
    Counter: ({ value }: { value: number }) => <span data-testid={'counter'}>{value}</span>
}))

jest.mock('@/components/layout/snackbar', () => ({
    Notification: ({ message, variant }: { message: string; variant: string }) => (
        <div
            data-testid={'notification-item'}
            data-variant={variant}
        >
            {message}
        </div>
    )
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
    return { store, ...render(<Provider store={store}>{ui}</Provider>) }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockList = (value: Record<string, unknown>) =>
    jest.mocked(API.useNotificationsGetListInfiniteQuery).mockReturnValue(value as any)

const listResult = (items: Array<Record<string, unknown>>, extra: Record<string, unknown> = {}) => ({
    data: { pageParams: [''], pages: [{ count: items.length, items, next: null }] },
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetching: false,
    isFetchingNextPage: false,
    isLoading: false,
    ...extra
})

describe('NotificationList', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockList({ data: undefined, isFetching: false, isLoading: false })
    })

    describe('rendering', () => {
        it('renders the bell button', () => {
            renderWithStore(<NotificationList />)
            const button = screen.getByRole('button', { name: '' })
            expect(button).toBeInTheDocument()
            expect(button).toHaveAttribute('data-icon', 'Bell')
        })

        it('does not render the counter when unread count is 0', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            jest.mocked(API.useNotificationsGetUpdatesQuery).mockReturnValue({ data: { count: 0 } } as any)
            renderWithStore(<NotificationList />)
            expect(screen.queryByTestId('counter')).not.toBeInTheDocument()
        })

        it('renders the counter with unread count when counter > 0', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            jest.mocked(API.useNotificationsGetUpdatesQuery).mockReturnValue({ data: { count: 3 } } as any)
            renderWithStore(<NotificationList />)
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
        it('renders the items of every loaded page as list rows', () => {
            mockList({
                ...listResult([]),
                data: {
                    pageParams: ['', 'n1'],
                    pages: [
                        {
                            count: 2,
                            items: [{ id: 'n1', message: 'First notification', read: false, type: 'success' }]
                        },
                        { count: 2, items: [{ id: 'n2', message: 'Second notification', read: true, type: 'success' }] }
                    ]
                }
            })

            renderWithStore(<NotificationList />)

            const items = screen.getAllByTestId('notification-item')
            expect(items).toHaveLength(2)
            expect(items[0]).toHaveAttribute('data-variant', 'list')
        })

        it('renders spinner when loading', () => {
            mockList({ ...listResult([]), data: undefined, isLoading: true })

            renderWithStore(<NotificationList />)
            expect(screen.getByTestId('spinner')).toBeInTheDocument()
        })

        it('loads the list only while the popout is open', () => {
            renderWithStore(<NotificationList />)
            expect(API.useNotificationsGetListInfiniteQuery).toHaveBeenLastCalledWith(
                undefined,
                expect.objectContaining({ skip: true })
            )

            fireEvent.click(screen.getByTestId('popout-trigger'))

            expect(API.useNotificationsGetListInfiniteQuery).toHaveBeenLastCalledWith(
                undefined,
                expect.objectContaining({ refetchOnMountOrArgChange: true, skip: false })
            )
        })

        it('marks the unread rows shown in the open list as read, once', () => {
            mockList(
                listResult([
                    { id: 'n1', message: 'New', read: false, type: 'success' },
                    { id: 'n2', message: 'Old', read: true, type: 'success' }
                ])
            )

            const { rerender, store } = renderWithStore(<NotificationList />)
            expect(mockMarkRead).not.toHaveBeenCalled()

            fireEvent.click(screen.getByTestId('popout-trigger'))
            rerender(
                <Provider store={store}>
                    <NotificationList />
                </Provider>
            )

            expect(mockMarkRead).toHaveBeenCalledTimes(1)
            expect(mockMarkRead).toHaveBeenCalledWith({ ids: ['n1'] })
        })

        it('loads the next page when the list is scrolled to its end', () => {
            const fetchNextPage = jest.fn()
            mockList(
                listResult([{ id: 'n1', message: 'First', read: true, type: 'success' }], {
                    fetchNextPage,
                    hasNextPage: true
                })
            )

            renderWithStore(<NotificationList />)

            const scroller = screen.getByTestId('notification-item').parentElement as HTMLElement
            Object.defineProperty(scroller, 'scrollHeight', { value: 300 })
            Object.defineProperty(scroller, 'clientHeight', { value: 280 })
            fireEvent.scroll(scroller, { target: { scrollTop: 10 } })

            expect(fetchNextPage).toHaveBeenCalledTimes(1)
        })

        it('clears the list and the toasts, and confirms it with a toast', async () => {
            mockClear.mockReturnValue({ unwrap: () => Promise.resolve() })
            mockList(listResult([{ id: 'n1', message: 'First', read: true, type: 'success' }]))

            const { store } = renderWithStore(<NotificationList />, {
                notification: { list: [{ id: 'old', message: 'Old toast', type: 'success' }] }
            })

            await act(async () => {
                fireEvent.click(screen.getByText('Очистить список'))
            })

            expect(mockClear).toHaveBeenCalled()
            expect(store.getState().notification.list.map(({ id }) => id)).toStrictEqual(['clearNotification'])
        })
    })
})
