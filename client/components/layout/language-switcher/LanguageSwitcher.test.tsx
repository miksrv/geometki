import React from 'react'
import { Provider } from 'react-redux'

import { configureStore } from '@reduxjs/toolkit'
import { fireEvent, render, screen } from '@testing-library/react'

import applicationReducer from '@/app/applicationSlice'
import authReducer from '@/app/authSlice'
import notificationReducer from '@/app/notificationSlice'

import { LanguageSwitcher } from './LanguageSwitcher'

jest.mock('cookies-next', () => ({
    getCookie: jest.fn(() => ''),
    setCookie: jest.fn()
}))

jest.mock('@/utils/localstorage', () => ({
    getItem: jest.fn(() => ''),
    setItem: jest.fn(),
    removeItem: jest.fn()
}))

jest.mock('../../../next-i18next.config', () => ({
    i18n: { defaultLocale: 'ru' }
}))

const mockPush = jest.fn().mockResolvedValue(true)
const mockChangeLanguage = jest.fn().mockResolvedValue(undefined)

jest.mock('next/router', () => ({
    useRouter: () => ({
        pathname: '/',
        asPath: '/',
        query: {},
        push: mockPush
    })
}))

jest.mock('next-i18next', () => ({
    useTranslation: () => ({
        i18n: {
            language: 'ru',
            changeLanguage: mockChangeLanguage
        }
    })
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        i18n: {
            language: 'ru',
            changeLanguage: mockChangeLanguage
        }
    })
}))

jest.mock('@/hooks/useLocalStorage', () => jest.fn().mockReturnValue(['ru', jest.fn()]))

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

describe('LanguageSwitcher', () => {
    beforeEach(() => {
        mockPush.mockClear()
        mockChangeLanguage.mockClear()
    })

    describe('rendering', () => {
        it('renders Eng and Rus buttons', () => {
            renderWithStore(<LanguageSwitcher />)
            expect(screen.getByText('Eng')).toBeInTheDocument()
            expect(screen.getByText('Rus')).toBeInTheDocument()
        })

        it('marks the current language (ru) button as active', () => {
            renderWithStore(<LanguageSwitcher />)
            expect(screen.getByText('Rus')).toHaveClass('active')
            expect(screen.getByText('Eng')).not.toHaveClass('active')
        })
    })

    describe('interaction', () => {
        it('calls i18n.changeLanguage when clicking a different language', async () => {
            renderWithStore(<LanguageSwitcher />)
            fireEvent.click(screen.getByText('Eng'))
            // changeLanguage is called asynchronously
            await Promise.resolve()
            expect(mockChangeLanguage).toHaveBeenCalledWith('en')
        })

        it('does not call changeLanguage when clicking the current language', async () => {
            renderWithStore(<LanguageSwitcher />)
            fireEvent.click(screen.getByText('Rus'))
            await Promise.resolve()
            expect(mockChangeLanguage).not.toHaveBeenCalled()
        })
    })
})
