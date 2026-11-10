import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { UploadZone } from './UploadZone'

jest.mock('simple-react-ui-kit', () => ({
    Icon: () => null,
    cn: (...args: unknown[]) => args.filter(Boolean).join(' ')
}))

const dropEvent = (files: File[]) => ({ dataTransfer: { files, types: ['Files'] } })

describe('UploadZone', () => {
    it('is a button with its title and hint that opens the picker', () => {
        const onClick = jest.fn()
        render(
            <UploadZone
                title={'Выберите фото'}
                hint={'JPG, PNG или WEBP, до 5 МБ'}
                onClick={onClick}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: /Выберите фото/ }))

        expect(screen.getByText('JPG, PNG или WEBP, до 5 МБ')).toBeInTheDocument()
        expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('takes dropped files when it has onDrop', () => {
        const onDrop = jest.fn()
        const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' })
        render(
            <UploadZone
                title={'Выберите фото'}
                onDrop={onDrop}
            />
        )

        fireEvent.drop(screen.getByRole('button'), dropEvent([file]))

        expect(onDrop).toHaveBeenCalledWith([file])
    })

    it('takes no drops of its own without onDrop', () => {
        const outer = jest.fn()
        render(
            <div onDrop={outer}>
                <UploadZone title={'Фото этого места пока нет'} />
            </div>
        )

        fireEvent.drop(screen.getByRole('button'), dropEvent([]))

        expect(outer).toHaveBeenCalledTimes(1)
    })

    it('does nothing while disabled', () => {
        const onClick = jest.fn()
        render(
            <UploadZone
                title={'Выберите фото'}
                disabled={true}
                onClick={onClick}
            />
        )

        fireEvent.click(screen.getByRole('button'))

        expect(onClick).not.toHaveBeenCalled()
    })
})
