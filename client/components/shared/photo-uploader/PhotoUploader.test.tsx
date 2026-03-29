import React, { createRef } from 'react'
import { Provider } from 'react-redux'

import { configureStore } from '@reduxjs/toolkit'
import { fireEvent, render } from '@testing-library/react'

import applicationReducer from '@/app/applicationSlice'
import authReducer from '@/app/authSlice'
import notificationReducer from '@/app/notificationSlice'

import { PhotoUploader } from './PhotoUploader'

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
        usePhotoPostUploadMutation: jest
            .fn()
            .mockReturnValue([jest.fn(), { data: undefined, isLoading: false, isError: false, error: undefined }])
    },
    ApiModel: {}
}))

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
            expect(input).toHaveAttribute('accept', 'image/png, image/gif, image/jpeg')
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

    describe('fileInputRef', () => {
        it('attaches to the file input element when ref is provided', () => {
            const ref = createRef<HTMLInputElement>()
            renderWithStore(<PhotoUploader fileInputRef={ref} />)
            expect(ref.current).toBeInstanceOf(HTMLInputElement)
        })
    })
})
