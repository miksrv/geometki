import React from 'react'

import { fireEvent, screen } from '@testing-library/react'

import { makeTestStore, renderWithStore } from '@/__mocks__/commonMocks'

import { BottomNav, isBottomNavItemActive } from './BottomNav'

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
    Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />
}))

jest.mock('@/utils/localstorage', () => ({
    getItem: jest.fn().mockReturnValue(null),
    setItem: jest.fn(),
    removeItem: jest.fn()
}))

jest.mock('../../../next-i18next.config', () => ({
    i18n: { defaultLocale: 'ru' }
}))

const authenticatedStore = () =>
    makeTestStore({
        auth: { isAuth: true, user: { id: 'u1', name: 'Alice' } }
    })

const guestStore = () =>
    makeTestStore({
        auth: { isAuth: false, user: undefined }
    })

describe('isBottomNavItemActive', () => {
    it('matches the route and nested routes', () => {
        expect(isBottomNavItemActive('/users', '/users')).toBe(true)
        expect(isBottomNavItemActive('/users/[id]/photos', '/users')).toBe(true)
        expect(isBottomNavItemActive('/map', '/users')).toBe(false)
    })
})

describe('BottomNav', () => {
    beforeEach(() => {
        mockRouter.pathname = '/'
    })

    it('renders the navigation landmark with five items', () => {
        renderWithStore(<BottomNav />)
        const nav = screen.getByRole('navigation', { name: 'Основная навигация' })
        expect(nav.querySelectorAll('a')).toHaveLength(5)
    })

    it('renders section links', () => {
        renderWithStore(<BottomNav />)
        expect(screen.getByRole('link', { name: 'Карта' })).toHaveAttribute('href', '/map')
        expect(screen.getByRole('link', { name: 'Места' })).toHaveAttribute('href', '/places')
        expect(screen.getByRole('link', { name: 'Коллекции' })).toHaveAttribute('href', '/collections')
        expect(screen.getByRole('link', { name: 'Люди' })).toHaveAttribute('href', '/users')
        expect(screen.getByRole('link', { name: 'Добавить' })).toHaveAttribute('href', '/places/create')
    })

    it('does not render the activity feed link (moved out of the bottom nav)', () => {
        renderWithStore(<BottomNav />)
        expect(screen.queryByRole('link', { name: 'Лента' })).not.toBeInTheDocument()
    })

    it('keeps the primary add-place action exactly in the center, two items on each side', () => {
        renderWithStore(<BottomNav />, { store: authenticatedStore() })
        const nav = screen.getByRole('navigation', { name: 'Основная навигация' })
        const links = Array.from(nav.querySelectorAll('a'))
        expect(links).toHaveLength(5)
        expect(links[2]).toHaveAttribute('href', '/places/create')
        expect(links.slice(0, 2).map((link) => link.getAttribute('href'))).toEqual(['/map', '/places'])
        expect(links.slice(3).map((link) => link.getAttribute('href'))).toEqual(['/collections', '/users'])
    })

    it('marks the current section with aria-current', () => {
        mockRouter.pathname = '/map'
        renderWithStore(<BottomNav />)
        expect(screen.getByRole('link', { name: 'Карта' })).toHaveAttribute('aria-current', 'page')
        expect(screen.getByRole('link', { name: 'Места' })).not.toHaveAttribute('aria-current')
    })

    it('does not render a profile item (the profile is behind the app bar avatar)', () => {
        renderWithStore(<BottomNav />, { store: authenticatedStore() })
        expect(screen.queryByRole('link', { name: 'Профиль' })).not.toBeInTheDocument()
    })

    it('opens the auth dialog when a guest taps add', () => {
        const { store } = renderWithStore(<BottomNav />, { store: guestStore() })

        fireEvent.click(screen.getByRole('link', { name: 'Добавить' }))
        expect(store.getState().application.showAuthDialog).toBe(true)
    })

    it('lets a guest open the users section without the auth dialog', () => {
        const { store } = renderWithStore(<BottomNav />, { store: guestStore() })

        fireEvent.click(screen.getByRole('link', { name: 'Люди' }))
        expect(store.getState().application.showAuthDialog).toBe(false)
    })

    it('does not open the auth dialog for public sections', () => {
        const { store } = renderWithStore(<BottomNav />, { store: guestStore() })

        fireEvent.click(screen.getByRole('link', { name: 'Карта' }))
        expect(store.getState().application.showAuthDialog).toBe(false)
    })
})
