import React from 'react'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'

jest.mock('react-leaflet', () => ({
    Marker: ({ position, eventHandlers, children }: any) => (
        <div
            data-testid={'point-marker'}
            data-lat={position[0]}
            data-lon={position[1]}
            onClick={eventHandlers?.click}
        >
            {children}
        </div>
    ),
    Popup: ({ children }: any) => <div data-testid={'marker-popup'}>{children}</div>
}))

jest.mock('leaflet', () => ({
    Icon: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('next/image', () => {
    const Image = ({ src, alt, className }: any) => <img src={src} alt={alt} className={className} />
    Image.displayName = 'Image'
    return Image
})

jest.mock('next/link', () => {
    const Link = ({ href, children, title }: any) => <a href={href} title={title}>{children}</a>
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

jest.mock('@/api', () => ({
    API: {
        usePoiGetItemMutation: jest.fn().mockReturnValue([jest.fn(), { isLoading: false, data: undefined }])
    },
    ApiModel: {
        Categories: {}
    }
}))

jest.mock('@/components/shared', () => ({
    BookmarkButton: () => <div data-testid={'bookmark-button'} />,
    PlacePlate: ({ icon, content }: any) => <div data-testid={'place-plate'}>{content}</div>
}))

jest.mock('@/config/env', () => ({
    IMG_HOST: 'https://img.example.com'
}))

jest.mock('@/features/categories/categories.utils', () => ({
    categoryImage: jest.fn().mockReturnValue({ src: '/icons/category.png' })
}))

jest.mock('@/utils/helpers', () => ({
    addDecimalPoint: jest.fn((v: number) => String(v)),
    numberFormatter: jest.fn((v: number) => String(v))
}))

jest.mock('simple-react-ui-kit', () => ({
    Skeleton: () => <div data-testid={'skeleton'} />
}))

jest.mock('@/config/constants', () => ({
    LOCAL_STORAGE: { RETURN_PATH: 'returnPath', LOCALE: 'locale', THEME: 'theme', LOCATION: 'location', MAP_CENTER: 'mapCenter' },
    AUTH_COOKIES: { SESSION: 'session', TOKEN: 'token' }
}))

import applicationReducer from '@/app/applicationSlice'
import authReducer from '@/app/authSlice'
import notificationReducer from '@/app/notificationSlice'

import { MarkerPoint } from './MarkerPoint'

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

const mockPlace = {
    id: 'place-1',
    lat: 51.765,
    lon: 55.099,
    category: 'abandoned',
    type: 'place'
}

describe('MarkerPoint', () => {
    it('renders a Marker at the place coordinates', () => {
        renderWithStore(<MarkerPoint place={mockPlace as any} />)
        const marker = screen.getByTestId('point-marker')
        expect(marker).toHaveAttribute('data-lat', '51.765')
        expect(marker).toHaveAttribute('data-lon', '55.099')
    })

    it('renders a Popup for places with an id', () => {
        renderWithStore(<MarkerPoint place={mockPlace as any} />)
        expect(screen.getByTestId('marker-popup')).toBeInTheDocument()
    })

    it('renders a BookmarkButton inside the popup', () => {
        renderWithStore(<MarkerPoint place={mockPlace as any} />)
        expect(screen.getByTestId('bookmark-button')).toBeInTheDocument()
    })

    it('renders skeleton when loading', () => {
        const { API } = require('@/api')
        API.usePoiGetItemMutation.mockReturnValue([jest.fn(), { isLoading: true, data: undefined }])
        renderWithStore(<MarkerPoint place={mockPlace as any} />)
        expect(screen.getByTestId('skeleton')).toBeInTheDocument()
    })

    it('creates an Icon from the category image', () => {
        const Leaflet = require('leaflet')
        renderWithStore(<MarkerPoint place={mockPlace as any} />)
        expect(Leaflet.Icon).toHaveBeenCalledWith(
            expect.objectContaining({ iconUrl: '/icons/category.png' })
        )
    })
})
