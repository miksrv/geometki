import React from 'react'

import { act, fireEvent, render, screen } from '@testing-library/react'

import { UserAvatarEditor } from './UserAvatarEditor'

const mockUploadAvatar = jest.fn()
const mockDispatch = jest.fn()

jest.mock('simple-react-ui-kit', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Button: ({ label, onClick, disabled }: any) => (
        <button
            type={'button'}
            disabled={disabled}
            onClick={onClick}
        >
            {label}
        </button>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
    Spinner: () => null
}))

jest.mock('react-image-crop', () => ({ __esModule: true, default: () => null }))
jest.mock('react-image-crop/src/ReactCrop.scss', () => ({}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}))

jest.mock('@/api', () => ({
    API: {
        useUsersPatchCropAvatarMutation: () => [jest.fn(), {}],
        useUsersPostUploadAvatarMutation: () => [mockUploadAvatar, {}]
    }
}))

jest.mock('@/app/store', () => ({ useAppDispatch: () => mockDispatch }))
jest.mock('@/app/applicationSlice', () => ({ toggleOverlay: jest.fn() }))
jest.mock('@/app/notificationSlice', () => ({ Notify: (payload: unknown) => payload }))

jest.mock('@/components/ui', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    UploadZone: ({ title, onClick }: any) => (
        <button
            type={'button'}
            onClick={onClick}
        >
            {title}
        </button>
    )
}))

const pick = async (file: File) => {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    await act(async () => {
        fireEvent.change(input, { target: { files: [file] } })
    })
}

describe('UserAvatarEditor', () => {
    beforeEach(() => {
        mockUploadAvatar.mockClear()
        mockDispatch.mockClear()
        render(<UserAvatarEditor />)
        fireEvent.click(screen.getByRole('button', { name: 'avatar' }))
    })

    it('offers the upload zone with the types the API takes, no GIF', () => {
        expect(screen.getByRole('button', { name: 'avatar-upload-title' })).toBeInTheDocument()
        expect(document.querySelector('input[type="file"]')).toHaveAttribute(
            'accept',
            'image/jpeg, image/png, image/webp'
        )
    })

    it('uploads a WEBP photo', async () => {
        await pick(new File(['x'], 'a.webp', { type: 'image/webp' }))

        expect(mockUploadAvatar).toHaveBeenCalledTimes(1)
    })

    it('refuses a GIF without sending it', async () => {
        await pick(new File(['x'], 'a.gif', { type: 'image/gif' }))

        expect(mockUploadAvatar).not.toHaveBeenCalled()
        expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ message: 'avatar-upload-rejected' }))
    })

    it('refuses a photo over 5 MB without sending it', async () => {
        const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' })
        Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 + 1 })

        await pick(file)

        expect(mockUploadAvatar).not.toHaveBeenCalled()
    })
})
