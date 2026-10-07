import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { FileDropZone } from './FileDropZone'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
    Icon: () => <svg />
}))

const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })

const fileTransfer = { dropEffect: 'none', files: [file], types: ['Files'] }
const textTransfer = { dropEffect: 'none', files: [], types: ['text/plain'] }

const renderZone = (props: Partial<React.ComponentProps<typeof FileDropZone>> = {}) =>
    render(
        <FileDropZone
            label={'Перетащите сюда'}
            {...props}
        >
            <div data-testid={'content'}>{'Фотографии'}</div>
        </FileDropZone>
    )

describe('FileDropZone', () => {
    it('shows the overlay while files are dragged over and hides it when they leave', () => {
        renderZone()
        const content = screen.getByTestId('content')

        fireEvent.dragEnter(content, { dataTransfer: fileTransfer })
        expect(screen.getByText('Перетащите сюда')).toBeInTheDocument()

        fireEvent.dragLeave(content, { dataTransfer: fileTransfer })
        expect(screen.queryByText('Перетащите сюда')).not.toBeInTheDocument()
    })

    it('keeps the overlay while the drag moves between nested elements', () => {
        renderZone()
        const content = screen.getByTestId('content')

        fireEvent.dragEnter(content.parentElement!, { dataTransfer: fileTransfer })
        fireEvent.dragEnter(content, { dataTransfer: fileTransfer })
        fireEvent.dragLeave(content.parentElement!, { dataTransfer: fileTransfer })

        expect(screen.getByText('Перетащите сюда')).toBeInTheDocument()
    })

    it('hands the dropped files to onDrop and hides the overlay', () => {
        const onDrop = jest.fn()
        renderZone({ onDrop })
        const content = screen.getByTestId('content')

        fireEvent.dragEnter(content, { dataTransfer: fileTransfer })
        fireEvent.drop(content, { dataTransfer: fileTransfer })

        expect(onDrop).toHaveBeenCalledWith([file])
        expect(screen.queryByText('Перетащите сюда')).not.toBeInTheDocument()
    })

    it('ignores drags that carry no files', () => {
        const onDrop = jest.fn()
        renderZone({ onDrop })
        const content = screen.getByTestId('content')

        fireEvent.dragEnter(content, { dataTransfer: textTransfer })
        fireEvent.drop(content, { dataTransfer: textTransfer })

        expect(screen.queryByText('Перетащите сюда')).not.toBeInTheDocument()
        expect(onDrop).not.toHaveBeenCalled()
    })

    it('does nothing when disabled', () => {
        const onDrop = jest.fn()
        renderZone({ disabled: true, onDrop })
        const content = screen.getByTestId('content')

        fireEvent.dragEnter(content, { dataTransfer: fileTransfer })
        fireEvent.drop(content, { dataTransfer: fileTransfer })

        expect(screen.queryByText('Перетащите сюда')).not.toBeInTheDocument()
        expect(onDrop).not.toHaveBeenCalled()
    })
})
