import React from 'react'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { MAILING_IMAGE_MAX_SIZE, MailingImage } from './MailingImage'

const mockDispatch = jest.fn()

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}))

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ src, alt }: { src: string; alt: string }) => (
        <img
            src={src}
            alt={alt}
        />
    )
}))

jest.mock('@/app/store', () => ({ useAppDispatch: () => mockDispatch }))

jest.mock('@/app/notificationSlice', () => ({ Notify: (payload: unknown) => payload }))

jest.mock('@/components/ui', () => ({
    UploadZone: ({ title, hint, onClick, onDrop }: any) => (
        <div>
            <button onClick={onClick}>{title}</button>
            <span>{hint}</span>
            <button onClick={() => onDrop([new File(['x'], 'drop.jpg', { type: 'image/jpeg' })])}>drop</button>
        </div>
    )
}))

const pick = (file: File) => fireEvent.change(screen.getByTestId('mailing-image-input'), { target: { files: [file] } })

describe('MailingImage', () => {
    beforeEach(() => mockDispatch.mockClear())

    it('offers the upload zone while there is no picture, and takes a dropped file', async () => {
        const onSelect = jest.fn()

        render(<MailingImage onSelect={onSelect} />)

        expect(screen.getByText('admin-mailing-image-upload-title')).toBeInTheDocument()
        expect(screen.getByText('admin-mailing-image-upload-hint')).toBeInTheDocument()

        fireEvent.click(screen.getByText('drop'))

        await waitFor(() => expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ name: 'drop.jpg' })))
    })

    it('refuses a file of a wrong type or too big, with a toast', () => {
        const onSelect = jest.fn()

        render(<MailingImage onSelect={onSelect} />)

        pick(new File(['x'], 'a.webp', { type: 'image/webp' }))

        const big = new File(['x'], 'big.png', { type: 'image/png' })
        Object.defineProperty(big, 'size', { value: MAILING_IMAGE_MAX_SIZE + 1 })
        pick(big)

        expect(onSelect).not.toHaveBeenCalled()
        expect(mockDispatch).toHaveBeenCalledTimes(2)
        expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ message: 'admin-mailing-image-rejected' }))
    })

    it('shows the picture with "Заменить" and "Удалить"', async () => {
        const onSelect = jest.fn()
        const onRemove = jest.fn()

        const { container } = render(
            <MailingImage
                src={'https://img/letter.png'}
                onSelect={onSelect}
                onRemove={onRemove}
            />
        )

        expect(container.querySelector('img')).toHaveAttribute('src', 'https://img/letter.png')
        expect(screen.queryByText('admin-mailing-image-upload-title')).not.toBeInTheDocument()

        pick(new File(['x'], 'new.png', { type: 'image/png' }))
        await waitFor(() => expect(onSelect).toHaveBeenCalled())

        fireEvent.click(screen.getByText('admin-mailing-image-remove'))
        await waitFor(() => expect(onRemove).toHaveBeenCalled())
    })

    it('only shows the picture of a sent mailing, or says there is none', () => {
        const { rerender } = render(
            <MailingImage
                src={'https://img/letter.png'}
                readOnly={true}
                onSelect={jest.fn()}
            />
        )

        expect(screen.queryByText('admin-mailing-image-replace')).not.toBeInTheDocument()

        rerender(
            <MailingImage
                readOnly={true}
                onSelect={jest.fn()}
            />
        )

        expect(screen.getByText('admin-mailing-image-none')).toBeInTheDocument()
    })
})
