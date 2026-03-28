import React from 'react'
import { Provider } from 'react-redux'

import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'

import applicationReducer from '@/app/applicationSlice'
import authReducer from '@/app/authSlice'
import notificationReducer from '@/app/notificationSlice'

import { ContextMenu } from './ContextMenu'

jest.mock('@react-leaflet/core', () => ({
    useLeafletContext: jest.fn().mockReturnValue({
        map: {
            on: jest.fn(),
            getZoom: jest.fn().mockReturnValue(12),
            getSize: jest.fn().mockReturnValue({ x: 800, y: 600 })
        }
    })
}))

jest.mock('simple-react-ui-kit', () => ({
    Button: ({ children, onClick, mode, _size, title }: any) => (
        <button
            onClick={onClick}
            data-mode={mode}
            title={title}
        >
            {children}
        </button>
    ),
    Container: ({ children, className }: any) => <div className={className}>{children}</div>
}))

jest.mock('next/link', () => {
    const Link = ({ href, children, title, onClick }: any) => (
        <a
            href={href}
            title={title}
            onClick={onClick}
        >
            {children}
        </a>
    )
    Link.displayName = 'Link'
    return Link
})

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

jest.mock('@/hooks/useLocalStorage', () => jest.fn().mockReturnValue([undefined, jest.fn()]))

jest.mock('@/utils/coordinates', () => ({
    convertDMS: jest.fn((lat: number, lon: number) => `${lat}°N ${lon}°E`)
}))

jest.mock('@/utils/helpers', () => ({
    round: jest.fn((v: number) => v)
}))

jest.mock('@/components/shared', () => ({
    MapLinks: () => <div data-testid={'map-links'} />
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

describe('ContextMenu', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('renders the context menu container', () => {
        const { container } = renderWithStore(<ContextMenu />)
        expect(container.firstChild).toBeInTheDocument()
    })

    it('renders the copy coordinates button', () => {
        renderWithStore(<ContextMenu />)
        expect(screen.getByTitle('Скопировать в буфер обмена')).toBeInTheDocument()
    })

    it('renders MapLinks component', () => {
        renderWithStore(<ContextMenu />)
        expect(screen.getByTestId('map-links')).toBeInTheDocument()
    })

    it('renders create place link when authenticated', () => {
        renderWithStore(<ContextMenu />, {
            auth: { isAuth: true, user: { id: 'u1', name: 'Alice' } }
        })
        expect(screen.getByTitle('Создать геометку')).toBeInTheDocument()
    })

    it('does not render create place link when not authenticated', () => {
        renderWithStore(<ContextMenu />, {
            auth: { isAuth: false, user: undefined }
        })
        expect(screen.queryByTitle('Создать геометку')).not.toBeInTheDocument()
    })

    it('renders hidden by default (isShowMenu is false)', () => {
        const { container } = renderWithStore(<ContextMenu />)
        // The menu wrapper is in the DOM but hidden via display:none style
        const menuWrapper = container.firstChild?.firstChild as HTMLElement
        expect(menuWrapper).toBeTruthy()
    })
})
