import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: string[]) => args.filter(Boolean).join(' '),
    Button: ({ label, onClick, disabled, mode, className, title }: any) => (
        <button
            data-mode={mode}
            disabled={disabled}
            className={className}
            title={title}
            onClick={onClick}
        >
            {label}
        </button>
    ),
    Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />
}))

jest.mock('next-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => opts?.defaultValue ?? key
    })
}))

jest.mock('react-hook-geolocation', () => () => ({ latitude: null, longitude: null }))

jest.mock('@/api', () => ({
    API: {
        useLocationPutCoordinatesMutation: jest.fn().mockReturnValue([jest.fn()])
    },
    ApiType: {}
}))

jest.mock('@/utils/localstorage', () => ({
    getItem: jest.fn().mockReturnValue(null),
    setItem: jest.fn(),
    removeItem: jest.fn()
}))

jest.mock('../../../next-i18next.config', () => ({
    i18n: { defaultLocale: 'ru' }
}))

jest.mock('./AppAuthChecker', () => ({
    AppAuthChecker: () => <div data-testid={'app-auth-checker'} />
}))

jest.mock('./Logo', () => ({
    Logo: () => <div data-testid={'logo'} />
}))

jest.mock('./NotificationList', () => ({
    NotificationList: () => <div data-testid={'notification-list'} />
}))

jest.mock('./Search', () => ({
    Search: () => <input data-testid={'search'} />
}))

jest.mock('./UserMenu', () => ({
    UserMenu: ({ onLogout }: any) => <div data-testid={'user-menu'} onClick={onLogout} />
}))

import { makeTestStore, renderWithStore } from '@/__mocks__/commonMocks'

import { AppBar } from './AppBar'

describe('AppBar', () => {
    describe('rendering', () => {
        it('renders the header element', () => {
            renderWithStore(<AppBar />)
            expect(screen.getByRole('banner')).toBeInTheDocument()
        })

        it('renders the logo', () => {
            renderWithStore(<AppBar />)
            expect(screen.getByTestId('logo')).toBeInTheDocument()
        })

        it('renders the search', () => {
            renderWithStore(<AppBar />)
            expect(screen.getByTestId('search')).toBeInTheDocument()
        })

        it('renders the auth checker', () => {
            renderWithStore(<AppBar />)
            expect(screen.getByTestId('app-auth-checker')).toBeInTheDocument()
        })

        it('renders the hamburger menu button', () => {
            renderWithStore(<AppBar />)
            expect(screen.getByRole('button', { name: 'Toggle Sidebar' })).toBeInTheDocument()
        })
    })

    describe('unauthenticated state', () => {
        it('renders the login button when not authenticated', () => {
            const store = makeTestStore({
                auth: { isAuth: false, user: undefined }
            })
            renderWithStore(<AppBar />, { store })
            expect(screen.getByText('Войти')).toBeInTheDocument()
        })

        it('does not render notification list when not authenticated', () => {
            const store = makeTestStore({
                auth: { isAuth: false, user: undefined }
            })
            renderWithStore(<AppBar />, { store })
            expect(screen.queryByTestId('notification-list')).not.toBeInTheDocument()
        })
    })

    describe('authenticated state', () => {
        it('renders notification list when authenticated', () => {
            const store = makeTestStore({
                auth: { isAuth: true, user: { id: 'u1', name: 'Alice' } }
            })
            renderWithStore(<AppBar />, { store })
            expect(screen.getByTestId('notification-list')).toBeInTheDocument()
        })

        it('renders user menu when authenticated with user data', () => {
            const store = makeTestStore({
                auth: { isAuth: true, user: { id: 'u1', name: 'Alice' } }
            })
            renderWithStore(<AppBar />, { store })
            expect(screen.getByTestId('user-menu')).toBeInTheDocument()
        })

        it('does not render the login button when authenticated', () => {
            const store = makeTestStore({
                auth: { isAuth: true, user: { id: 'u1', name: 'Alice' } }
            })
            renderWithStore(<AppBar />, { store })
            expect(screen.queryByText('Войти')).not.toBeInTheDocument()
        })
    })

    describe('callbacks', () => {
        it('calls onMenuClick when hamburger button is clicked', () => {
            const onMenuClick = jest.fn()
            renderWithStore(<AppBar onMenuClick={onMenuClick} />)
            fireEvent.click(screen.getByRole('button', { name: 'Toggle Sidebar' }))
            expect(onMenuClick).toHaveBeenCalledTimes(1)
        })
    })

    describe('fullSize prop', () => {
        it('applies fullSize class when fullSize is true', () => {
            renderWithStore(<AppBar fullSize />)
            expect(screen.getByRole('banner')).toHaveClass('fullSize')
        })
    })
})
