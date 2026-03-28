import React from 'react'

import { fireEvent, screen } from '@testing-library/react'

import { makeTestStore, renderWithStore } from '@/__mocks__/commonMocks'

import { SiteMenu } from './SiteMenu'

jest.mock('simple-react-ui-kit', () => ({
    Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />
}))

jest.mock('next/link', () => {
    const Link = ({ href, title, onClick, children }: any) => (
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

jest.mock('@/app/applicationSlice', () => ({
    openAuthDialog: jest.fn().mockReturnValue({ type: 'application/openAuthDialog' }),
    default: (
        state: Record<string, unknown> = { showAuthDialog: false, showOverlay: false, userLocation: null },
        _action: unknown
    ) => state
}))

describe('SiteMenu', () => {
    describe('rendering', () => {
        it('renders a menu element', () => {
            const { container } = renderWithStore(<SiteMenu />)
            expect(container.querySelector('menu')).toBeInTheDocument()
        })

        it('renders the news feed link', () => {
            renderWithStore(<SiteMenu />)
            expect(screen.getByTitle('Новостная лента')).toBeInTheDocument()
        })

        it('renders the map link', () => {
            renderWithStore(<SiteMenu />)
            expect(screen.getByTitle('Карта интересных мест')).toBeInTheDocument()
        })

        it('renders the places link', () => {
            renderWithStore(<SiteMenu />)
            expect(screen.getByTitle('Все интересные места')).toBeInTheDocument()
        })

        it('renders the categories link', () => {
            renderWithStore(<SiteMenu />)
            expect(screen.getByTitle('Категории мест')).toBeInTheDocument()
        })

        it('renders the tags link', () => {
            renderWithStore(<SiteMenu />)
            expect(screen.getByTitle('Особенности мест')).toBeInTheDocument()
        })

        it('renders the users link', () => {
            renderWithStore(<SiteMenu />)
            expect(screen.getByTitle('Пользователи')).toBeInTheDocument()
        })
    })

    describe('authenticated user', () => {
        it('renders add place link for authenticated user with userId', () => {
            renderWithStore(
                <SiteMenu
                    isAuth={true}
                    userId={'user-1'}
                />
            )
            expect(screen.getByTitle('Добавить место на карту')).toBeInTheDocument()
        })

        it('renders my page link with correct href when userId is provided', () => {
            renderWithStore(
                <SiteMenu
                    isAuth={true}
                    userId={'user-1'}
                />
            )
            expect(screen.getByTitle('Моя страница')).toHaveAttribute('href', '/users/user-1')
        })

        it('renders my photos link with correct href when userId is provided', () => {
            renderWithStore(
                <SiteMenu
                    isAuth={true}
                    userId={'user-1'}
                />
            )
            expect(screen.getByTitle('Мои фотографии')).toHaveAttribute('href', '/users/user-1/photos')
        })
    })

    describe('unauthenticated user — auth-guarded links', () => {
        it('dispatches openAuthDialog when clicking add place while not authenticated', () => {
            const store = makeTestStore()
            const dispatchSpy = jest.spyOn(store, 'dispatch')

            renderWithStore(
                <SiteMenu
                    isAuth={false}
                    userId={'user-1'}
                />,
                { store }
            )

            const addPlaceLink = screen.getByTitle('Добавить место на карту')
            fireEvent.click(addPlaceLink)

            expect(dispatchSpy).toHaveBeenCalled()
        })
    })

    describe('onClick callback', () => {
        it('calls onClick when a menu link is clicked', () => {
            const onClick = jest.fn()
            renderWithStore(
                <SiteMenu
                    onClick={onClick}
                    isAuth={true}
                />
            )
            fireEvent.click(screen.getByTitle('Новостная лента'))
            expect(onClick).toHaveBeenCalledTimes(1)
        })
    })
})
