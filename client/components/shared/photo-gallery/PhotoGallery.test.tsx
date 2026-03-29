import React from 'react'
import { Provider } from 'react-redux'

import { configureStore } from '@reduxjs/toolkit'
import { fireEvent, render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'
import applicationReducer from '@/app/applicationSlice'
import authReducer from '@/app/authSlice'
import notificationReducer from '@/app/notificationSlice'

import { PhotoGallery } from './PhotoGallery'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: string[]) => args.filter(Boolean).join(' '),
    Button: ({ label, icon, onClick, disabled, mode, _size, className, style }: any) => (
        <button
            data-icon={icon}
            data-mode={mode}
            disabled={disabled}
            className={className}
            style={style}
            onClick={onClick}
        >
            {label}
        </button>
    ),
    Container: ({ children, className, title, _action, _footer }: any) => (
        <div
            className={className}
            data-title={title}
        >
            {children}
        </div>
    ),
    Popout: ({ trigger, children, _closeOnChildrenClick, className }: any) => (
        <div className={className}>
            <div data-testid={'popout-trigger'}>{trigger}</div>
            <div data-testid={'popout-content'}>{children}</div>
        </div>
    ),
    Spinner: () => <div data-testid={'spinner'} />
}))

jest.mock('next/dynamic', () => (_fn: () => Promise<{ default: React.ComponentType }>) => {
    const MockDialog = ({ open, onAccept, onReject, message, acceptText }: any) =>
        open ? (
            <div data-testid={'confirmation-dialog'}>
                {message}
                <button onClick={onAccept}>confirm-{acceptText}</button>
                <button onClick={onReject}>reject</button>
            </div>
        ) : null
    MockDialog.displayName = 'MockConfirmationDialog'
    return MockDialog
})

jest.mock('next/image', () => {
    const Image = ({ src, alt, width, height, className }: any) => (
        <img
            src={src}
            alt={alt}
            width={width}
            height={height}
            className={className}
        />
    )
    Image.displayName = 'Image'
    return Image
})

jest.mock('next/link', () => {
    const Link = ({ href, className, onClick, children }: any) => (
        <a
            href={href}
            className={className}
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

jest.mock('@/api', () => ({
    API: {
        usePhotoDeleteItemMutation: jest
            .fn()
            .mockReturnValue([jest.fn(), { data: undefined, isLoading: false, error: undefined }]),
        usePhotoRotateItemMutation: jest
            .fn()
            .mockReturnValue([jest.fn(), { data: undefined, isLoading: false, error: undefined }])
    },
    ApiModel: {}
}))

jest.mock('@/utils/api', () => ({
    getErrorMessage: jest.fn().mockReturnValue('Error')
}))

jest.mock('@/config/env', () => ({
    IMG_HOST: 'https://img.example.com'
}))

jest.mock('@/components/shared', () => ({
    PhotoLightbox: ({ showLightbox }: any) => (showLightbox ? <div data-testid={'photo-lightbox'} /> : null)
}))

jest.mock('@/components/ui', () => ({
    ImageUploader: ({ onClick }: any) => (
        <button
            data-testid={'image-uploader'}
            onClick={onClick}
        >
            Upload
        </button>
    )
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

const mockPhotos: ApiModel.Photo[] = [
    { id: 'ph1', full: '/photos/full-1.jpg', preview: '/photos/prev-1.jpg', title: 'Photo 1', width: 800, height: 600 },
    { id: 'ph2', full: '/photos/full-2.jpg', preview: '/photos/prev-2.jpg', title: 'Photo 2', width: 800, height: 600 }
]

describe('PhotoGallery', () => {
    describe('empty state', () => {
        it('renders empty state message when no photos', () => {
            renderWithStore(<PhotoGallery />)
            expect(screen.getByText('Тут пока нет фотографий')).toBeInTheDocument()
        })

        it('does not render the photo list when no photos', () => {
            const { container } = renderWithStore(<PhotoGallery />)
            expect(container.querySelector('ul')).not.toBeInTheDocument()
        })
    })

    describe('with photos', () => {
        it('renders photos when provided', () => {
            renderWithStore(<PhotoGallery photos={mockPhotos} />)
            const images = document.querySelectorAll('img')
            expect(images.length).toBeGreaterThanOrEqual(2)
        })

        it('does not render empty state when photos are provided', () => {
            renderWithStore(<PhotoGallery photos={mockPhotos} />)
            expect(screen.queryByText('Тут пока нет фотографий')).not.toBeInTheDocument()
        })
    })

    describe('upload actions', () => {
        it('renders ImageUploader when onPhotoUploadClick is provided', () => {
            renderWithStore(
                <PhotoGallery
                    photos={mockPhotos}
                    onPhotoUploadClick={jest.fn()}
                />
            )
            expect(screen.getByTestId('image-uploader')).toBeInTheDocument()
        })

        it('does not render ImageUploader when onPhotoUploadClick is not provided', () => {
            renderWithStore(<PhotoGallery photos={mockPhotos} />)
            expect(screen.queryByTestId('image-uploader')).not.toBeInTheDocument()
        })

        it('calls onPhotoUploadClick when ImageUploader is clicked', () => {
            const onPhotoUploadClick = jest.fn()
            renderWithStore(
                <PhotoGallery
                    photos={mockPhotos}
                    onPhotoUploadClick={onPhotoUploadClick}
                />
            )
            fireEvent.click(screen.getByTestId('image-uploader'))
            expect(onPhotoUploadClick).toHaveBeenCalledTimes(1)
        })
    })

    describe('uploading state', () => {
        it('renders spinner placeholders for uploading photos', () => {
            renderWithStore(
                <PhotoGallery
                    photos={[]}
                    uploadingPhotos={['blob:photo1', 'blob:photo2']}
                />
            )
            expect(screen.getAllByTestId('spinner')).toHaveLength(2)
        })
    })

    describe('photo actions — authenticated user', () => {
        it('renders action buttons when user is authenticated and hideActions is false', () => {
            renderWithStore(<PhotoGallery photos={mockPhotos} />, {
                auth: { isAuth: true, user: { id: 'u1', name: 'Alice' } }
            })
            const actionButtons = screen.getAllByRole('button')
            expect(actionButtons.length).toBeGreaterThan(0)
        })

        it('does not render action buttons when hideActions is true', () => {
            renderWithStore(
                <PhotoGallery
                    photos={mockPhotos}
                    hideActions={true}
                />,
                {
                    auth: { isAuth: true, user: { id: 'u1', name: 'Alice' } }
                }
            )
            const dots = screen.queryAllByRole('button').filter((b) => b.getAttribute('data-icon') === 'VerticalDots')
            expect(dots).toHaveLength(0)
        })
    })
})
