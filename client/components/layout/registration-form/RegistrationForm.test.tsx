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
    Input: ({ label, name, type, error, disabled, onChange, onKeyDown, value }: any) => (
        <div>
            <label htmlFor={name}>{label}</label>
            <input
                id={name}
                name={name}
                type={type || 'text'}
                disabled={disabled}
                value={value ?? ''}
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

jest.mock('next/dist/client/router', () => ({
    useRouter: () => ({
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
        useAuthPostRegistrationMutation: jest.fn().mockReturnValue([
            jest.fn().mockResolvedValue({ data: { auth: false } }),
            { data: undefined, error: undefined, isLoading: false }
        ])
    },
    ApiType: {}
}))

jest.mock('@/utils/api', () => ({
    isApiValidationErrors: jest.fn().mockReturnValue(false)
}))

jest.mock('@/utils/validators', () => ({
    validateEmail: jest.fn((email: string) => !!email && email.includes('@'))
}))

jest.mock('@/config/constants', () => ({
    LOCAL_STORAGE: { RETURN_PATH: 'returnPath', LOCALE: 'locale', THEME: 'theme', LOCATION: 'location', MAP_CENTER: 'mapCenter' },
    AUTH_COOKIES: { SESSION: 'session', TOKEN: 'token' }
}))

import applicationReducer from '@/app/applicationSlice'
import authReducer from '@/app/authSlice'
import notificationReducer from '@/app/notificationSlice'

import { RegistrationForm } from './RegistrationForm'

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

describe('RegistrationForm', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('rendering', () => {
        it('renders the name input', () => {
            renderWithStore(<RegistrationForm />)
            expect(screen.getByLabelText('Имя')).toBeInTheDocument()
        })

        it('renders the email input', () => {
            renderWithStore(<RegistrationForm />)
            expect(screen.getByLabelText('Email адрес')).toBeInTheDocument()
        })

        it('renders the password input', () => {
            renderWithStore(<RegistrationForm />)
            expect(screen.getByLabelText('Пароль')).toBeInTheDocument()
        })

        it('renders the repeat password input', () => {
            renderWithStore(<RegistrationForm />)
            expect(screen.getByLabelText('Повторите пароль')).toBeInTheDocument()
        })

        it('renders the register button', () => {
            renderWithStore(<RegistrationForm />)
            expect(screen.getByText('Зарегистрироваться')).toBeInTheDocument()
        })

        it('renders the cancel button', () => {
            renderWithStore(<RegistrationForm />)
            expect(screen.getByText('Отмена')).toBeInTheDocument()
        })
    })

    describe('validation', () => {
        it('shows validation errors when submitting without filling fields', async () => {
            renderWithStore(<RegistrationForm />)
            fireEvent.click(screen.getByText('Зарегистрироваться'))
            await Promise.resolve()
            expect(screen.queryAllByRole('alert').length).toBeGreaterThan(0)
        })

        it('shows name required error when name is empty', async () => {
            renderWithStore(<RegistrationForm />)
            fireEvent.click(screen.getByText('Зарегистрироваться'))
            await Promise.resolve()
            expect(screen.getAllByText('Имя обязательно').length).toBeGreaterThan(0)
        })

        it('shows email error when email is invalid', async () => {
            renderWithStore(<RegistrationForm />)
            const nameInput = screen.getByLabelText('Имя')
            fireEvent.change(nameInput, { target: { name: 'name', value: 'John' } })
            fireEvent.click(screen.getByText('Зарегистрироваться'))
            await Promise.resolve()
            expect(screen.getAllByText('Некорректный email').length).toBeGreaterThan(0)
        })
    })

    describe('callbacks', () => {
        it('calls onClickLogin when cancel button is clicked', () => {
            const onClickLogin = jest.fn()
            renderWithStore(<RegistrationForm onClickLogin={onClickLogin} />)
            fireEvent.click(screen.getByText('Отмена'))
            expect(onClickLogin).toHaveBeenCalledTimes(1)
        })
    })
})
