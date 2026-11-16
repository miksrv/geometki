import React from 'react'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { ImageSlot } from './ImageSlot'

const mockDispatch = jest.fn()

jest.mock('@/app/store', () => ({ useAppDispatch: () => mockDispatch }))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}))

jest.mock('simple-react-ui-kit', () => ({
    Button: ({ label, onClick, disabled, 'aria-label': ariaLabel }: any) => (
        <button
            aria-label={ariaLabel}
            disabled={disabled}
            onClick={onClick}
        >
            {label}
        </button>
    )
}))

const file = (name: string, type: string, size: number) => {
    const result = new File(['x'], name, { type })

    Object.defineProperty(result, 'size', { value: size })

    return result
}

const notified = () => mockDispatch.mock.calls.map(([action]) => action.payload)

describe('ImageSlot', () => {
    beforeEach(() => mockDispatch.mockClear())

    const renderSlot = (props: Partial<React.ComponentProps<typeof ImageSlot>> = {}) => {
        const onUpload = jest.fn().mockResolvedValue(undefined)

        render(
            <ul>
                <ImageSlot
                    id={'gold'}
                    label={'Gold'}
                    preview={<i>preview</i>}
                    hasImage={false}
                    onUpload={onUpload}
                    {...props}
                />
            </ul>
        )

        return { input: screen.getByTestId('image-slot-input-gold'), onUpload }
    }

    it('refuses a 2 MB file without uploading it, and says so', () => {
        const { input, onUpload } = renderSlot()

        fireEvent.change(input, { target: { files: [file('big.png', 'image/png', 2 * 1024 * 1024)] } })

        expect(onUpload).not.toHaveBeenCalled()
        expect(notified()).toEqual([expect.objectContaining({ message: 'admin-image-rejected', type: 'error' })])
    })

    it('refuses a file that is not PNG or SVG', () => {
        const { input, onUpload } = renderSlot()

        fireEvent.change(input, { target: { files: [file('photo.jpg', 'image/jpeg', 1000)] } })

        expect(onUpload).not.toHaveBeenCalled()
        expect(notified()[0]).toMatchObject({ message: 'admin-image-rejected' })
    })

    it('uploads a fine file and reports the save', async () => {
        const { input, onUpload } = renderSlot()
        const png = file('ok.png', 'image/png', 1000)

        fireEvent.change(input, { target: { files: [png] } })

        await waitFor(() => expect(onUpload).toHaveBeenCalledWith(png))
        await waitFor(() => expect(notified()).toEqual([expect.objectContaining({ message: 'admin-image-saved' })]))
    })

    it('reports a failed upload', async () => {
        const { input } = renderSlot({ onUpload: jest.fn().mockRejectedValue({ messages: { error: 'Too wide' } }) })

        fireEvent.change(input, { target: { files: [file('ok.png', 'image/png', 1000)] } })

        await waitFor(() =>
            expect(notified()).toEqual([expect.objectContaining({ message: 'Too wide', type: 'error' })])
        )
    })

    it('names its buttons by what the picture is, and shows remove only for a picture that can go', () => {
        renderSlot({ hasImage: true, onRemove: jest.fn().mockResolvedValue(undefined) })

        expect(screen.getByRole('button', { name: 'admin-image-replace: Gold' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'admin-image-remove: Gold' })).toBeInTheDocument()
    })

    it('has no remove button without a remove action', () => {
        renderSlot({ hasImage: true })

        expect(screen.queryByRole('button', { name: /admin-image-remove/ })).not.toBeInTheDocument()
    })
})
