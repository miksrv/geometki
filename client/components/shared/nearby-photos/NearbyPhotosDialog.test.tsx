import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { NearbyPhotosDialog } from './NearbyPhotosDialog'

let mockIsAuth: boolean | undefined = false
const mockLinkPhoto = jest.fn()

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        i18n: { language: 'ru' },
        t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key
    })
}))

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ alt }: { alt: string }) => (
        <img
            alt={alt}
            src={''}
        />
    )
}))

// Render the lightbox stub at once instead of loading it
jest.mock('next/dynamic', () => ({
    __esModule: true,
    default: () =>
        function PhotoLightboxStub({ photoIndex }: { photoIndex: number }) {
            return <div data-testid={'lightbox'}>{photoIndex}</div>
        }
}))

jest.mock('simple-react-ui-kit', () => ({
    Button: ({ label, onClick }: { label?: string; onClick?: () => void }) => (
        <button
            type={'button'}
            onClick={onClick}
        >
            {label}
        </button>
    ),
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
    Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) => (open ? <div>{children}</div> : null),
    Icon: ({ name }: { name: string }) => <span data-icon={name} />,
    Skeleton: () => null,
    Spinner: () => null
}))

jest.mock('@/app/store', () => ({
    useAppDispatch: () => jest.fn(),
    useAppSelector: (selector: (state: unknown) => unknown) => selector({ auth: { isAuth: mockIsAuth } })
}))

jest.mock('@/app/notificationSlice', () => ({ Notify: jest.fn() }))

jest.mock('@/api', () => ({
    API: {
        useExternalPhotosDeleteLinkMutation: () => [jest.fn()],
        useExternalPhotosGetListQuery: () => ({ data: { items: [] } }),
        useExternalPhotosPostLinkMutation: () => [mockLinkPhoto]
    }
}))

jest.mock('@/api/apiPastvu', () => ({
    APIPastvu: { useGetNearestQuery: () => ({ data: undefined, isFetching: false }) }
}))

jest.mock('@/api/apiWikimediaCommons', () => ({
    APIWikimediaCommons: { useGetNearbyQuery: () => ({ data: undefined, isFetching: false }) }
}))

jest.mock('./utils', () => ({
    ...jest.requireActual('./utils'),
    buildNearbyPhotos: () => [
        {
            distance: 120,
            externalId: '1',
            full: 'full-1.jpg',
            key: 'wikimedia:1',
            preview: 'preview-1.jpg',
            source: 'wikimedia',
            title: 'First photo'
        },
        {
            distance: 340,
            externalId: '2',
            full: 'full-2.jpg',
            key: 'pastvu:2',
            preview: 'preview-2.jpg',
            source: 'pastvu',
            title: 'Second photo'
        }
    ]
}))

const renderDialog = () =>
    render(
        <NearbyPhotosDialog
            place={{ id: 'place1', lat: 55, lon: 37 }}
            open={true}
            onClose={jest.fn()}
        />
    )

describe('NearbyPhotosDialog', () => {
    beforeEach(() => {
        mockIsAuth = false
        mockLinkPhoto.mockReset().mockReturnValue({ unwrap: () => Promise.resolve({ id: 'link1' }) })
    })

    it('shows the photos to a guest without the link buttons', () => {
        renderDialog()

        expect(screen.getByAltText('First photo')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Добавить в фотографии места' })).not.toBeInTheDocument()
    })

    it('opens the clicked photo in the lightbox', () => {
        renderDialog()

        fireEvent.click(screen.getAllByTitle('Посмотреть')[1])

        expect(screen.getByTestId('lightbox')).toHaveTextContent('1')
        expect(mockLinkPhoto).not.toHaveBeenCalled()
    })

    it('lets a signed-in user link a photo with the corner button', async () => {
        mockIsAuth = true
        renderDialog()

        fireEvent.click(screen.getAllByRole('button', { name: 'Добавить в фотографии места' })[0])

        expect(mockLinkPhoto).toHaveBeenCalledWith({ externalId: '1', placeId: 'place1', source: 'wikimedia' })
        expect(await screen.findByRole('button', { name: 'Убрать из фотографий места' })).toHaveAttribute(
            'aria-pressed',
            'true'
        )
        expect(screen.queryByTestId('lightbox')).not.toBeInTheDocument()
    })
})
