import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: string[]) => args.filter(Boolean).join(' '),
    Button: ({ label, mode, onClick, disabled, loading, children }: any) => (
        <button
            data-mode={mode}
            disabled={disabled || loading}
            onClick={onClick}
        >
            {label ?? children}
        </button>
    ),
    Input: ({ label, name, type, error, disabled, onChange, onKeyDown }: any) => (
        <div>
            <label htmlFor={name}>{label}</label>
            <input
                id={name}
                name={name}
                type={type || 'text'}
                disabled={disabled}
                aria-describedby={error ? `${name}-error` : undefined}
                onChange={onChange}
                onKeyDown={onKeyDown}
            />
            {error && <span id={`${name}-error`} role={'alert'}>{error}</span>}
        </div>
    ),
    Message: ({ type, title, children }: any) => (
        <div role={'alert'} data-type={type}>
            <strong>{title}</strong>
            {children}
        </div>
    )
}))

jest.mock('next/image', () => {
    const Image = ({ src, alt, width, height }: any) => (
        <img src={src} alt={alt} width={width} height={height} />
    )
    Image.displayName = 'Image'
    return Image
})

jest.mock('next/router', () => ({
    useRouter: () => ({
        asPath: '/',
        push: jest.fn().mockResolvedValue(true)
    })
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
        useAuthPostLoginMutation: jest.fn().mockReturnValue([
            jest.fn().mockResolvedValue({ data: { auth: false } }),
            { data: undefined, isLoading: false, isSuccess: false, error: undefined }
        ]),
        useAuthLoginServiceMutation: jest.fn().mockReturnValue([
            jest.fn().mockResolvedValue({ data: {} }),
            { data: undefined, isLoading: false, isSuccess: false }
        ])
    },
    ApiType: {}
}))

jest.mock('@/hooks/useLocalStorage', () => jest.fn().mockReturnValue([undefined, jest.fn()]))

jest.mock('@/utils/api', () => ({
    isApiValidationErrors: jest.fn().mockReturnValue(false)
}))

jest.mock('@/utils/validators', () => ({
    validateEmail: jest.fn((email: string) => !!email && email.includes('@'))
}))

jest.mock('@/public/images/google-logo.png', () => ({ src: '/google-logo.png' }), { virtual: true })
jest.mock('@/public/images/vk-logo.png', () => ({ src: '/vk-logo.png' }), { virtual: true })
jest.mock('@/public/images/yandex-logo.png', () => ({ src: '/yandex-logo.png' }), { virtual: true })

jest.mock('@/config/constants', () => ({
    LOCAL_STORAGE: { RETURN_PATH: 'returnPath', LOCALE: 'locale', THEME: 'theme', LOCATION: 'location', MAP_CENTER: 'mapCenter' },
    AUTH_COOKIES: { SESSION: 'session', TOKEN: 'token' }
}))

import applicationReducer from '@/app/applicationSlice'
import authReducer from '@/app/authSlice'
import notificationReducer from '@/app/notificationSlice'

import { LoginForm } from './LoginForm'

const makeStore = () =>
    configureStore({
        reducer: {
            application: applicationReducer,
            auth: authReducer,
            notification: notificationReducer
        }
    })

const renderWithStore = (ui: React.ReactElement) => {
    const store = makeStore()
    return render(<Provider store={store}>{ui}</Provider>)
}

describe('LoginForm', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('rendering', () => {
        it('renders the email input', () => {
            renderWithStore(<LoginForm />)
            expect(screen.getByLabelText('Email адрес')).toBeInTheDocument()
        })

        it('renders the password input', () => {
            renderWithStore(<LoginForm />)
            expect(screen.getByLabelText('Пароль')).toBeInTheDocument()
        })

        it('renders the sign-in button', () => {
            renderWithStore(<LoginForm />)
            expect(screen.getByText('Войти')).toBeInTheDocument()
        })

        it('renders the registration link button', () => {
            renderWithStore(<LoginForm />)
            expect(screen.getByText('Регистрация')).toBeInTheDocument()
        })

        it('renders social login buttons (VK, Google, Yandex)', () => {
            renderWithStore(<LoginForm />)
            const buttons = screen.getAllByRole('button')
            expect(buttons.length).toBeGreaterThanOrEqual(3)
        })
    })

    describe('validation', () => {
        it('shows validation errors when submitting an empty form', async () => {
            renderWithStore(<LoginForm />)
            fireEvent.click(screen.getByText('Войти'))
            await Promise.resolve()
            expect(screen.queryAllByRole('alert').length).toBeGreaterThan(0)
        })

        it('shows email error when email is invalid', async () => {
            renderWithStore(<LoginForm />)
            const emailInput = screen.getByLabelText('Email адрес')
            fireEvent.change(emailInput, { target: { name: 'email', value: 'not-an-email' } })
            fireEvent.click(screen.getByText('Войти'))
            await Promise.resolve()
            expect(screen.getAllByText('Введенный email адрес не корректный').length).toBeGreaterThan(0)
        })
    })

    describe('callbacks', () => {
        it('calls onClickRegistration when registration button is clicked', () => {
            const onClickRegistration = jest.fn()
            renderWithStore(<LoginForm onClickRegistration={onClickRegistration} />)
            fireEvent.click(screen.getByText('Регистрация'))
            expect(onClickRegistration).toHaveBeenCalledTimes(1)
        })
    })
})
