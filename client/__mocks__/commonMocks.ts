/**
 * Shared test utilities and mocks for the geometki client test suite.
 *
 * Import from this file instead of duplicating mock setup across test files.
 */
import React from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'

// ---------------------------------------------------------------------------
// Redux store factory
// ---------------------------------------------------------------------------

import applicationReducer from '../app/applicationSlice'
import authReducer from '../app/authSlice'
import notificationReducer from '../app/notificationSlice'

/** Creates a lightweight test store that only wires the three app slices.
 *  RTK Query reducers are intentionally omitted – use mock hooks instead. */
export const makeTestStore = (preloadedState?: Record<string, unknown>) =>
    configureStore({
        reducer: {
            application: applicationReducer,
            auth: authReducer,
            notification: notificationReducer
        },
        preloadedState
    })

/** Default store instance (unauthenticated, no notifications). */
export const defaultStore = makeTestStore()

// ---------------------------------------------------------------------------
// Test wrapper
// ---------------------------------------------------------------------------

interface WrapperProps {
    store?: ReturnType<typeof makeTestStore>
    children?: React.ReactNode
}

export const TestWrapper: React.FC<WrapperProps> = ({ store = defaultStore, children }) =>
    React.createElement(Provider, { store }, children)

/** RTL render helper that automatically wraps children in a Redux Provider. */
export const renderWithStore = (
    ui: React.ReactElement,
    {
        store = makeTestStore(),
        ...options
    }: RenderOptions & { store?: ReturnType<typeof makeTestStore> } = {}
) => {
    const Wrapper: React.FC<{ children?: React.ReactNode }> = ({ children }) =>
        React.createElement(Provider, { store }, children)

    return { store, ...render(ui, { wrapper: Wrapper, ...options }) }
}

// ---------------------------------------------------------------------------
// next/router mock
// ---------------------------------------------------------------------------

export const mockRouter = {
    pathname: '/',
    asPath: '/',
    query: {},
    push: jest.fn().mockResolvedValue(true),
    replace: jest.fn().mockResolvedValue(true),
    prefetch: jest.fn().mockResolvedValue(undefined),
    back: jest.fn(),
    forward: jest.fn(),
    reload: jest.fn(),
    events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn()
    },
    isFallback: false,
    isReady: true,
    locale: 'ru',
    locales: ['ru', 'en'],
    defaultLocale: 'ru'
}

// ---------------------------------------------------------------------------
// next-i18next / react-i18next mock
// ---------------------------------------------------------------------------

/** Minimal useTranslation mock: returns the key as the translated value. */
export const mockUseTranslation = (namespace?: string) => ({
    t: (key: string, opts?: Record<string, unknown>) => opts?.defaultValue ?? key,
    i18n: {
        language: 'ru',
        changeLanguage: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
        off: jest.fn()
    },
    ready: true
})

// ---------------------------------------------------------------------------
// Sample API model fixtures
// ---------------------------------------------------------------------------

export const mockUser = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    avatar: '/avatars/user-1.jpg',
    reputation: 42,
    role: 'user' as const
}

export const mockNotification = {
    id: 'notif-1',
    title: 'Test notification',
    message: 'This is a test message',
    type: 'success' as const,
    read: false
}

export const mockPlace = {
    id: 'place-1',
    title: 'Test Place',
    lat: 55.75,
    lon: 37.62,
    views: 100,
    content: 'Test **content**'
}
