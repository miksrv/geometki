import React from 'react'

import { fireEvent, screen } from '@testing-library/react'

import { makeTestStore, renderWithStore } from '@/__mocks__/commonMocks'
import { API } from '@/api'

import { AppBar, isNavItemActive } from './AppBar'

const mockRouter = {
    pathname: '/',
    asPath: '/',
    query: {},
    push: jest.fn().mockResolvedValue(true),
    replace: jest.fn().mockResolvedValue(true)
}

jest.mock('next/router', () => ({
    useRouter: () => mockRouter
}))

jest.mock('next/link', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Link = ({ href, children, className, onClick, ...rest }: any) => (
        <a
            href={href}
            className={className}
            onClick={onClick}
            {...rest}
        >
            {children}
        </a>
    )
    Link.displayName = 'Link'
    return Link
})

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: string[]) => args.filter(Boolean).join(' '),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Button: ({ label, onClick, disabled, mode, className, title, link, icon }: any) =>
        link ? (
            <a
                href={link}
                data-mode={mode}
                data-icon={icon}
                className={className}
                title={title}
                onClick={onClick}
            >
                {label}
            </a>
        ) : (
            <button
                data-mode={mode}
                data-icon={icon}
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

jest.mock('react-hook-geolocation', () => () => ({ latitude: null, longitude: null }))

jest.mock('@/api', () => ({
    API: {
        useLocationPutCoordinatesMutation: jest.fn().mockReturnValue([jest.fn()]),
        util: { resetApiState: jest.fn(() => ({ type: 'api/resetApiState' })) }
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    UserMenu: ({ onLogout }: any) => (
        <div
            data-testid={'user-menu'}
            onClick={onLogout}
        />
    )
}))

const authenticatedStore = () =>
    makeTestStore({
        auth: { isAuth: true, user: { id: 'u1', name: 'Alice' } }
    })

const guestStore = () =>
    makeTestStore({
        auth: { isAuth: false, user: undefined }
    })

describe('isNavItemActive', () => {
    it('matches the exact route', () => {
        expect(isNavItemActive('/places', '/places')).toBe(true)
    })

    it('matches nested routes', () => {
        expect(isNavItemActive('/places/123', '/places')).toBe(true)
    })

    it('does not match routes with a shared prefix only', () => {
        expect(isNavItemActive('/placesXYZ', '/places')).toBe(false)
        expect(isNavItemActive('/', '/places')).toBe(false)
    })
})

describe('AppBar', () => {
    beforeEach(() => {
        mockRouter.pathname = '/'
    })

    describe('rendering', () => {
        it('renders the header element', () => {
            renderWithStore(<AppBar />)
            expect(screen.getByRole('banner')).toBeInTheDocument()
        })

        it('renders the logo, search and auth checker', () => {
            renderWithStore(<AppBar />)
            expect(screen.getByTestId('logo')).toBeInTheDocument()
            expect(screen.getByTestId('search')).toBeInTheDocument()
            expect(screen.getByTestId('app-auth-checker')).toBeInTheDocument()
        })

        it('renders the main navigation with site sections', () => {
            renderWithStore(<AppBar />)
            const nav = screen.getByRole('navigation', { name: 'Основная навигация' })
            expect(nav).toBeInTheDocument()
            expect(screen.getByRole('link', { name: 'Карта' })).toHaveAttribute('href', '/map')
            expect(screen.getByRole('link', { name: 'Места' })).toHaveAttribute('href', '/places')
            expect(screen.getByRole('link', { name: 'Коллекции' })).toHaveAttribute('href', '/collections')
            expect(screen.getByRole('link', { name: 'Люди' })).toHaveAttribute('href', '/users')
            expect(nav.querySelectorAll('a')).toHaveLength(4)
        })

        it('does not render the activity feed link (reachable from the home page widget)', () => {
            renderWithStore(<AppBar />)
            expect(screen.queryByRole('link', { name: 'Лента' })).not.toBeInTheDocument()
        })

        it('does not render a hamburger button', () => {
            renderWithStore(<AppBar />)
            expect(screen.queryByRole('button', { name: 'Toggle Sidebar' })).not.toBeInTheDocument()
        })

        it('renders the add place action', () => {
            renderWithStore(<AppBar />)
            expect(screen.getByRole('link', { name: 'Добавить место' })).toHaveAttribute('href', '/places/create')
        })
    })

    describe('active section', () => {
        it('marks the current section with aria-current', () => {
            mockRouter.pathname = '/places/[id]'
            renderWithStore(<AppBar />)
            expect(screen.getByRole('link', { name: 'Места' })).toHaveAttribute('aria-current', 'page')
            expect(screen.getByRole('link', { name: 'Карта' })).not.toHaveAttribute('aria-current')
        })
    })

    describe('unauthenticated state', () => {
        it('renders the login button when not authenticated', () => {
            renderWithStore(<AppBar />, { store: guestStore() })
            expect(screen.getByText('Войти')).toBeInTheDocument()
        })

        it('does not render notification list or user menu when not authenticated', () => {
            renderWithStore(<AppBar />, { store: guestStore() })
            expect(screen.queryByTestId('notification-list')).not.toBeInTheDocument()
            expect(screen.queryByTestId('user-menu')).not.toBeInTheDocument()
        })

        it('opens the auth dialog instead of navigating when a guest clicks add place', () => {
            const { store } = renderWithStore(<AppBar />, { store: guestStore() })
            fireEvent.click(screen.getByRole('link', { name: 'Добавить место' }))
            expect(store.getState().application.showAuthDialog).toBe(true)
        })

        it('opens the auth dialog when the login button is clicked', () => {
            const { store } = renderWithStore(<AppBar />, { store: guestStore() })
            fireEvent.click(screen.getByText('Войти'))
            expect(store.getState().application.showAuthDialog).toBe(true)
        })
    })

    describe('authenticated state', () => {
        it('renders notification list and user menu when authenticated', () => {
            renderWithStore(<AppBar />, { store: authenticatedStore() })
            expect(screen.getByTestId('notification-list')).toBeInTheDocument()
            expect(screen.getByTestId('user-menu')).toBeInTheDocument()
        })

        it('does not render the login button when authenticated', () => {
            renderWithStore(<AppBar />, { store: authenticatedStore() })
            expect(screen.queryByText('Войти')).not.toBeInTheDocument()
        })

        it('does not open the auth dialog when an authenticated user clicks add place', () => {
            const { store } = renderWithStore(<AppBar />, { store: authenticatedStore() })
            fireEvent.click(screen.getByRole('link', { name: 'Добавить место' }))
            expect(store.getState().application.showAuthDialog).toBe(false)
        })

        it('logs out when the user menu requests it', () => {
            const { store } = renderWithStore(<AppBar />, { store: authenticatedStore() })
            fireEvent.click(screen.getByTestId('user-menu'))
            expect(store.getState().auth.isAuth).toBe(false)
            // The cache holds the user's own state (bookmarks, visits)
            expect(API.util.resetApiState).toHaveBeenCalled()
        })
    })

    describe('fullSize prop', () => {
        it('applies fullSize class when fullSize is true', () => {
            renderWithStore(<AppBar fullSize />)
            expect(screen.getByRole('banner')).toHaveClass('fullSize')
        })
    })
})
