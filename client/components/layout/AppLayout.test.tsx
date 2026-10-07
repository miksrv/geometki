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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        ) : null
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AppBar: ({ fullSize }: any) => (
        <div
            data-testid={'app-bar'}
            data-full-size={fullSize ? 'true' : 'false'}
        />
    )
}))

jest.mock('./bottom-nav', () => ({
    BottomNav: () => <nav data-testid={'bottom-nav'} />
}))

jest.mock('./footer', () => ({
    Footer: () => <footer data-testid={'footer'} />
}))

jest.mock('./login-form', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    LoginForm: ({ onClickRegistration }: any) => (
        <div data-testid={'login-form'}>
            <button onClick={onClickRegistration}>Go to registration</button>
        </div>
    )
}))

jest.mock('./registration-form', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RegistrationForm: ({ onClickLogin }: any) => (
        <div data-testid={'registration-form'}>
            <button onClick={onClickLogin}>Go to login</button>
        </div>
    )
}))

jest.mock('./snackbar', () => ({
    Snackbar: () => <div data-testid={'snackbar'} />
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

const authDialogState = {
    application: { showAuthDialog: true, showOverlay: true, userLocation: undefined }
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

        it('renders children inside the main landmark', () => {
            renderWithStore(
                <AppLayout>
                    <div data-testid={'page-content'}>Page</div>
                </AppLayout>
            )
            expect(screen.getByRole('main')).toContainElement(screen.getByTestId('page-content'))
        })

        it('renders the footer and the bottom navigation', () => {
            renderWithStore(<AppLayout />)
            expect(screen.getByTestId('footer')).toBeInTheDocument()
            expect(screen.getByTestId('bottom-nav')).toBeInTheDocument()
        })

        it('does not render a site menu sidebar', () => {
            const { container } = renderWithStore(<AppLayout />)
            expect(container.querySelector('aside')).not.toBeInTheDocument()
        })
    })

    describe('auth dialog', () => {
        it('does not render auth dialog when showAuthDialog is false', () => {
            renderWithStore(<AppLayout />)
            expect(screen.queryByTestId('auth-dialog')).not.toBeInTheDocument()
        })

        it('renders the auth dialog when showAuthDialog is true', () => {
            renderWithStore(<AppLayout />, authDialogState)
            expect(screen.getByTestId('auth-dialog')).toBeInTheDocument()
        })

        it('shows LoginForm by default in the auth dialog', () => {
            renderWithStore(<AppLayout />, authDialogState)
            expect(screen.getByTestId('login-form')).toBeInTheDocument()
        })

        it('switches to RegistrationForm when onClickRegistration is called', async () => {
            renderWithStore(<AppLayout />, authDialogState)
            fireEvent.click(screen.getByText('Go to registration'))
            // RegistrationForm is loaded via next/dynamic, so it may not be mounted
            // synchronously the first time it is rendered.
            expect(await screen.findByTestId('registration-form')).toBeInTheDocument()
        })

        it('switches back to LoginForm when onClickLogin is called from RegistrationForm', () => {
            renderWithStore(<AppLayout />, authDialogState)
            fireEvent.click(screen.getByText('Go to registration'))
            fireEvent.click(screen.getByText('Go to login'))
            expect(screen.getByTestId('login-form')).toBeInTheDocument()
        })
    })

    describe('overlay', () => {
        it('locks body scroll while the overlay is displayed', () => {
            const { unmount } = renderWithStore(<AppLayout />, authDialogState)
            expect(document.body.style.overflow).toBe('hidden')
            unmount()
            expect(document.body.style.overflow).toBe('')
        })

        it('marks the overlay as displayed when showOverlay is true', () => {
            const { container } = renderWithStore(<AppLayout />, authDialogState)
            expect(container.querySelector('.overlay')).toHaveClass('displayed')
        })
    })

    describe('fullSize prop', () => {
        it('applies fullSize class to the layout wrapper when fullSize is true', () => {
            const { container } = renderWithStore(<AppLayout fullSize />)
            expect(container.firstChild).toHaveClass('fullSize')
        })

        it('passes fullSize to the AppBar', () => {
            renderWithStore(<AppLayout fullSize />)
            expect(screen.getByTestId('app-bar')).toHaveAttribute('data-full-size', 'true')
        })

        it('hides the footer but keeps the bottom navigation when fullSize is true', () => {
            renderWithStore(<AppLayout fullSize />)
            expect(screen.queryByTestId('footer')).not.toBeInTheDocument()
            expect(screen.getByTestId('bottom-nav')).toBeInTheDocument()
        })
    })
})
