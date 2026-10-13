import React from 'react'
import * as Leaflet from 'leaflet'

import { render, screen } from '@testing-library/react'

import { MarkerUser } from './MarkerUser'

jest.mock('react-leaflet', () => ({
    Marker: ({ position, children }: any) => (
        <div
            data-testid={'user-marker'}
            data-lat={position[0]}
            data-lon={position[1]}
        >
            {children}
        </div>
    ),
    Popup: ({ children }: any) => <div data-testid={'user-popup'}>{children}</div>
}))

jest.mock('leaflet', () => ({
    DivIcon: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({ t: (key: string, options?: any) => options?.defaultValue ?? key })
}))

jest.mock('@/config/env', () => ({ IMG_HOST: 'https://img.test/' }))

jest.mock('@/public/images/no-avatar.png', () => ({ src: '/images/no-avatar.png' }), { virtual: true })

jest.mock('@/components/shared/copy-coordinates', () => ({
    CopyCoordinates: ({ lat, lon }: { lat: number; lon: number }) => (
        <span data-testid={'coordinates'}>{`${lat} ${lon}`}</span>
    )
}))

jest.mock('@/components/shared/user-avatar', () => ({
    UserAvatar: ({ user, caption }: any) => (
        <div data-testid={'user-avatar'}>
            {user?.name ?? 'guest'}
            {caption}
        </div>
    )
}))

const mockAuth: { isAuth?: boolean; user?: any } = {}

jest.mock('@/app/store', () => ({
    useAppSelector: (selector: any) => selector({ auth: mockAuth })
}))

const iconHtml = () => (jest.mocked(Leaflet.DivIcon).mock.calls.at(-1)?.[0] as any)?.html as string

describe('MarkerUser', () => {
    const coordinates = { lat: 51.765, lon: 55.099 }

    beforeEach(() => {
        mockAuth.isAuth = undefined
        mockAuth.user = undefined
    })

    it('renders a Marker at the user coordinates', () => {
        render(<MarkerUser coordinates={coordinates} />)
        const marker = screen.getByTestId('user-marker')
        expect(marker).toHaveAttribute('data-lat', '51.765')
        expect(marker).toHaveAttribute('data-lon', '55.099')
    })

    it('shows the placeholder avatar for a guest', () => {
        render(<MarkerUser coordinates={coordinates} />)
        expect(iconHtml()).toContain('/images/no-avatar.png')
        expect(screen.getByTestId('user-avatar')).toHaveTextContent('guest')
    })

    it('shows the signed-in user avatar, name and level', () => {
        mockAuth.isAuth = true
        mockAuth.user = { avatar: 'uploads/avatars/u1/a_small.jpg', id: 'u1', levelData: { level: 7 }, name: 'Alice' }

        render(<MarkerUser coordinates={coordinates} />)

        expect(iconHtml()).toContain('https://img.test/uploads/avatars/u1/a_small.jpg')
        expect(screen.getByTestId('user-avatar')).toHaveTextContent('Alice')
        expect(screen.getByTestId('user-avatar')).toHaveTextContent('Уровень {{level}}')
    })

    it('shows the coordinates in the popup', () => {
        render(<MarkerUser coordinates={coordinates} />)
        expect(screen.getByTestId('coordinates')).toHaveTextContent('51.765 55.099')
    })
})
