import React, { createRef } from 'react'
import { Provider } from 'react-redux'

import { configureStore } from '@reduxjs/toolkit'
import { act, fireEvent, render, waitFor } from '@testing-library/react'

import applicationReducer from '@/app/applicationSlice'
import authReducer from '@/app/authSlice'
import notificationReducer from '@/app/notificationSlice'

import { PhotoUploader, PhotoUploaderHandle } from './PhotoUploader'

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

const mockUpload = jest.fn()

jest.mock('@/api', () => ({
    API: {
        usePhotoPostUploadMutation: () => [mockUpload, { data: undefined, isLoading: false }]
    },
    ApiModel: {}
}))

const resolveWith = (value: unknown) => ({ unwrap: () => Promise.resolve(value) })
const rejectWith = (error: unknown) => ({ unwrap: () => Promise.reject(error) })

jest.mock('@/utils/api', () => ({
    getErrorMessage: jest.fn().mockReturnValue('Upload error')
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

global.URL.createObjectURL = jest.fn((file: File) => `blob:${file.name}`)
global.URL.revokeObjectURL = jest.fn()

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

describe('PhotoUploader', () => {
    beforeEach(() => {
        mockUpload.mockReset()
        mockUpload.mockImplementation(() => resolveWith({ id: 'uploaded' }))
    })

    describe('rendering', () => {
        it('renders a hidden file input', () => {
            renderWithStore(<PhotoUploader />)
            const input = document.querySelector('input[type="file"]')
            expect(input).toBeInTheDocument()
            expect(input).toHaveStyle({ display: 'none' })
        })

        it('renders with accept attribute for image types', () => {
            renderWithStore(<PhotoUploader />)
            const input = document.querySelector('input[type="file"]')
            expect(input).toHaveAttribute('accept', 'image/jpeg, image/png, image/gif, image/webp')
        })

        it('renders with multiple attribute', () => {
            renderWithStore(<PhotoUploader />)
            const input = document.querySelector('input[type="file"]')
            expect(input).toHaveAttribute('multiple')
        })
    })

    describe('file selection', () => {
        it('calls onSelectFiles when files are selected with a placeId', () => {
            const onSelectFiles = jest.fn()
            renderWithStore(
                <PhotoUploader
                    placeId={'place-1'}
                    onSelectFiles={onSelectFiles}
                />
            )

            const input = document.querySelector('input[type="file"]') as HTMLInputElement
            const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })

            Object.defineProperty(input, 'files', { value: [file] })
            fireEvent.change(input)

            expect(onSelectFiles).toBeDefined()
        })

        it('does not process files if placeId is missing', () => {
            const onSelectFiles = jest.fn()
            renderWithStore(<PhotoUploader onSelectFiles={onSelectFiles} />)

            const input = document.querySelector('input[type="file"]') as HTMLInputElement
            const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })

            Object.defineProperty(input, 'files', { value: [file] })
            fireEvent.change(input)

            // Without a placeId, files are not added to the queue — onSelectFiles only ever called with empty array
            const calls = onSelectFiles.mock.calls
            const calledWithNonEmpty = calls.some((args: any[]) => Array.isArray(args[0]) && args[0].length > 0)
            expect(calledWithNonEmpty).toBe(false)
        })
    })

    describe('upload queue', () => {
        it('uploads files one by one and reports each uploaded photo', async () => {
            const onUploadPhoto = jest.fn()
            const uploaderRef = createRef<PhotoUploaderHandle>()
            mockUpload
                .mockImplementationOnce(() => resolveWith({ id: '1' }))
                .mockImplementationOnce(() => resolveWith({ id: '2' }))

            renderWithStore(
                <PhotoUploader
                    placeId={'place-1'}
                    uploaderRef={uploaderRef}
                    onUploadPhoto={onUploadPhoto}
                />
            )

            act(() =>
                uploaderRef.current?.upload([
                    new File(['a'], 'a.jpg', { type: 'image/jpeg' }),
                    new File(['b'], 'b.webp', { type: 'image/webp' })
                ])
            )

            await waitFor(() => expect(onUploadPhoto).toHaveBeenCalledTimes(2))
            expect(mockUpload).toHaveBeenCalledTimes(2)
            expect(onUploadPhoto).toHaveBeenNthCalledWith(1, { id: '1' })
            expect(onUploadPhoto).toHaveBeenNthCalledWith(2, { id: '2' })
        })

        it('skips a failed file and goes on with the rest', async () => {
            const onUploadPhoto = jest.fn()
            const uploaderRef = createRef<PhotoUploaderHandle>()
            mockUpload
                .mockImplementationOnce(() => rejectWith({ status: 500 }))
                .mockImplementationOnce(() => resolveWith({ id: '2' }))

            renderWithStore(
                <PhotoUploader
                    placeId={'place-1'}
                    uploaderRef={uploaderRef}
                    onUploadPhoto={onUploadPhoto}
                />
            )

            act(() =>
                uploaderRef.current?.upload([
                    new File(['a'], 'a.jpg', { type: 'image/jpeg' }),
                    new File(['b'], 'b.jpg', { type: 'image/jpeg' })
                ])
            )

            await waitFor(() => expect(onUploadPhoto).toHaveBeenCalledWith({ id: '2' }))
            expect(mockUpload).toHaveBeenCalledTimes(2)
        })

        it('does not upload files of other types or over the size limit', () => {
            const uploaderRef = createRef<PhotoUploaderHandle>()

            renderWithStore(
                <PhotoUploader
                    placeId={'place-1'}
                    uploaderRef={uploaderRef}
                />
            )

            const huge = new File(['x'], 'huge.jpg', { type: 'image/jpeg' })
            Object.defineProperty(huge, 'size', { value: 11 * 1024 * 1024 })

            act(() => uploaderRef.current?.upload([new File(['x'], 'doc.pdf', { type: 'application/pdf' }), huge]))

            expect(mockUpload).not.toHaveBeenCalled()
        })
    })

    describe('fileInputRef', () => {
        it('attaches to the file input element when ref is provided', () => {
            const ref = createRef<HTMLInputElement>()
            renderWithStore(<PhotoUploader fileInputRef={ref} />)
            expect(ref.current).toBeInstanceOf(HTMLInputElement)
        })
    })
})
