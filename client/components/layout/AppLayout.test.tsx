import React from 'react'
import { Provider } from 'react-redux'

import { configureStore } from '@reduxjs/toolkit'
import { fireEvent, render, screen } from '@testing-library/react'

import applicationReducer from '@/app/applicationSlice'
import authReducer from '@/app/authSlice'
import notificationReducer from '@/app/notificationSlice'

import { AppLayout } from './AppLayout'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: string[]) => args.filter(Boolean).join(' '),
    Dialog: ({ open, children, onCloseDialog }: any) =>
        open ? (
            <div
                role={'dialog'}
                data-testid={'auth-dialog'}
            >
                {children}
                <button
                    aria-label={'close-dialog'}
                    onClick={onCloseDialog}
                />
            </div>
        ) : null,
    Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />
}))

jest.mock('next-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => opts?.defaultValue ?? key
    })
}))

jest.mock('nextjs-progressbar', () => () => <div data-testid={'progress-bar'} />)

jest.mock('@/utils/localstorage', () => ({
    getItem: jest.fn().mockReturnValue(null),
    setItem: jest.fn(),
    removeItem: jest.fn()
}))

jest.mock('../../next-i18next.config', () => ({
    i18n: { defaultLocale: 'ru' }
}))

jest.mock('cookies-next', () => ({
    getCookie: jest.fn().mockReturnValue(''),
    setCookie: jest.fn(),
    deleteCookie: jest.fn()
}))

jest.mock('./app-bar', () => ({
    AppBar: ({ onMenuClick }: any) => (
        <div data-testid={'app-bar'}>
            <button
                data-testid={'menu-button'}
                onClick={onMenuClick}
            >
                Menu
            </button>
        </div>
    )
}))

jest.mock('./footer', () => ({
    Footer: () => <div data-testid={'footer'} />
}))

jest.mock('./language-switcher', () => ({
    LanguageSwitcher: () => <div data-testid={'language-switcher'} />
}))

jest.mock('./login-form', () => ({
    LoginForm: ({ onClickRegistration }: any) => (
        <div data-testid={'login-form'}>
            <button onClick={onClickRegistration}>Go to registration</button>
        </div>
    )
}))

jest.mock('./registration-form', () => ({
    RegistrationForm: ({ onClickLogin }: any) => (
        <div data-testid={'registration-form'}>
            <button onClick={onClickLogin}>Go to login</button>
        </div>
    )
}))

jest.mock('./site-menu', () => ({
    SiteMenu: () => <div data-testid={'site-menu'} />
}))

jest.mock('./snackbar', () => ({
    Snackbar: () => <div data-testid={'snackbar'} />
}))

jest.mock('./theme-switcher', () => ({
    ThemeSwitcher: () => <div data-testid={'theme-switcher'} />
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

describe('AppLayout', () => {
    describe('rendering', () => {
        it('renders without crashing', () => {
            const { container } = renderWithStore(<AppLayout />)
            expect(container.firstChild).toBeInTheDocument()
        })

        it('renders the AppBar', () => {
            renderWithStore(<AppLayout />)
            expect(screen.getByTestId('app-bar')).toBeInTheDocument()
        })

        it('renders the Snackbar', () => {
            renderWithStore(<AppLayout />)
            expect(screen.getByTestId('snackbar')).toBeInTheDocument()
        })

        it('renders children in the main content area', () => {
            renderWithStore(
                <AppLayout>
                    <div data-testid={'page-content'}>Page</div>
                </AppLayout>
            )
            expect(screen.getByTestId('page-content')).toBeInTheDocument()
        })

        it('renders the SiteMenu', () => {
            renderWithStore(<AppLayout />)
            expect(screen.getAllByTestId('site-menu').length).toBeGreaterThanOrEqual(1)
        })

        it('renders the ThemeSwitcher', () => {
            renderWithStore(<AppLayout />)
            expect(screen.getAllByTestId('theme-switcher').length).toBeGreaterThanOrEqual(1)
        })

        it('renders the LanguageSwitcher', () => {
            renderWithStore(<AppLayout />)
            expect(screen.getAllByTestId('language-switcher').length).toBeGreaterThanOrEqual(1)
        })
    })

    describe('auth dialog', () => {
        it('does not render auth dialog when showAuthDialog is false', () => {
            renderWithStore(<AppLayout />)
            expect(screen.queryByTestId('auth-dialog')).not.toBeInTheDocument()
        })

        it('renders the auth dialog when showAuthDialog is true', () => {
            renderWithStore(<AppLayout />, {
                application: { showAuthDialog: true, showOverlay: false, userLocation: null }
            })
            expect(screen.getByTestId('auth-dialog')).toBeInTheDocument()
        })

        it('shows LoginForm by default in the auth dialog', () => {
            renderWithStore(<AppLayout />, {
                application: { showAuthDialog: true, showOverlay: false, userLocation: null }
            })
            expect(screen.getByTestId('login-form')).toBeInTheDocument()
        })

        it('switches to RegistrationForm when onClickRegistration is called', () => {
            renderWithStore(<AppLayout />, {
                application: { showAuthDialog: true, showOverlay: false, userLocation: null }
            })
            fireEvent.click(screen.getByText('Go to registration'))
            expect(screen.getByTestId('registration-form')).toBeInTheDocument()
        })

        it('switches back to LoginForm when onClickLogin is called from RegistrationForm', () => {
            renderWithStore(<AppLayout />, {
                application: { showAuthDialog: true, showOverlay: false, userLocation: null }
            })
            fireEvent.click(screen.getByText('Go to registration'))
            fireEvent.click(screen.getByText('Go to login'))
            expect(screen.getByTestId('login-form')).toBeInTheDocument()
        })
    })

    describe('fullSize prop', () => {
        it('applies fullSize class to the layout wrapper when fullSize is true', () => {
            const { container } = renderWithStore(<AppLayout fullSize />)
            expect(container.firstChild).toHaveClass('fullSize')
        })

        it('does not render the desktop menubar aside when fullSize is true', () => {
            const { container } = renderWithStore(<AppLayout fullSize />)
            // Desktop menubar is .menubar — it should not exist in fullSize mode
            expect(container.querySelector('.menubar')).not.toBeInTheDocument()
        })
    })

    describe('sidebar', () => {
        it('opens the sidebar when menu button is clicked', () => {
            renderWithStore(<AppLayout />)
            fireEvent.click(screen.getByTestId('menu-button'))
            // Sidebar aside should have 'opened' class
            const sidebar = document.querySelector('.sidebar')
            expect(sidebar).toHaveClass('opened')
        })
    })
})
