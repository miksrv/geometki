import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'

import { PhotoViewer } from './PhotoViewer'

jest.mock('simple-react-ui-kit', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
    Icon: ({ name }: { name: string }) => <i data-icon={name} />,
    Spinner: () => <span data-testid={'spinner'} />
}))

jest.mock('next/dynamic', () => () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const MockLightbox = ({ photoIndex, toolbarButtons }: any) => (
        <div data-testid={'lightbox'}>
            {photoIndex}
            {toolbarButtons}
        </div>
    )
    return MockLightbox
})

jest.mock('next/image', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Image = ({ src, alt }: any) => (
        // eslint-disable-next-line next/no-img-element
        <img
            src={src}
            alt={alt}
        />
    )
    return Image
})

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) =>
            String((opts?.defaultValue as string) ?? key).replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, name) =>
                String(opts?.[name] ?? '')
            )
    })
}))

jest.mock('@/app/store', () => ({
    useAppSelector: (selector: (state: unknown) => unknown) => selector({ auth: { user: { id: 'me' } } })
}))

jest.mock('@/config/env', () => ({ IMG_HOST: 'https://img.test/' }))

const photos = [
    { id: 'a', full: 'a.jpg', preview: 'a_p.jpg', title: 'Ущелье', width: 4, height: 3, author: { id: 'me' } },
    { id: 'b', full: 'b.jpg', preview: 'b_p.jpg', title: 'Ущелье', width: 4, height: 3, author: { id: 'other' } },
    {
        id: 'c',
        full: 'https://commons/c.jpg',
        preview: 'https://commons/c_p.jpg',
        title: 'Ущелье',
        width: 4,
        height: 3,
        external: { source: 'wikimedia', url: 'https://commons/c' }
    }
] as ApiModel.Photo[]

describe('PhotoViewer', () => {
    it('renders nothing while closed', () => {
        render(
            <PhotoViewer
                photos={photos}
                state={null}
                onStateChange={jest.fn()}
            />
        )

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(screen.queryByTestId('lightbox')).not.toBeInTheDocument()
    })

    it('shows all the photos as a grid with the count and marks the own ones', () => {
        render(
            <PhotoViewer
                photos={photos}
                title={'Ущелье'}
                state={{ index: 0, mode: 'grid' }}
                onStateChange={jest.fn()}
            />
        )

        expect(screen.getByRole('dialog', { name: /Все фото \(3\)/ })).toBeInTheDocument()
        expect(screen.getAllByRole('img')).toHaveLength(3)
        expect(screen.getAllByText('ваше фото')).toHaveLength(1)
    })

    it('gives the tools to editors: no rotation for a linked photo', () => {
        const onRotate = jest.fn()
        const onDelete = jest.fn()

        render(
            <PhotoViewer
                photos={photos}
                state={{ index: 0, mode: 'grid' }}
                canEdit={true}
                onStateChange={jest.fn()}
                onRotate={onRotate}
                onDelete={onDelete}
            />
        )

        expect(screen.getAllByRole('button', { name: 'Повернуть' })).toHaveLength(2)

        fireEvent.click(screen.getAllByRole('button', { name: 'Повернуть' })[1])
        fireEvent.click(screen.getAllByRole('button', { name: 'Удалить' })[2])

        expect(onRotate).toHaveBeenCalledWith(photos[1])
        expect(onDelete).toHaveBeenCalledWith(photos[2])
    })

    it('hides the tools from guests', () => {
        render(
            <PhotoViewer
                photos={photos}
                state={{ index: 0, mode: 'grid' }}
                onStateChange={jest.fn()}
                onRotate={jest.fn()}
                onDelete={jest.fn()}
            />
        )

        expect(screen.queryByRole('button', { name: 'Повернуть' })).not.toBeInTheDocument()
    })

    it('opens a photo from the grid and closes', () => {
        const onStateChange = jest.fn()

        render(
            <PhotoViewer
                photos={photos}
                title={'Ущелье'}
                state={{ index: 0, mode: 'grid' }}
                onStateChange={onStateChange}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: 'Ущелье — фотография 2' }))
        expect(onStateChange).toHaveBeenLastCalledWith({ index: 1, mode: 'single' })

        fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }))
        expect(onStateChange).toHaveBeenLastCalledWith(null)
    })

    it('leads from one photo back to the grid and to adding photos', () => {
        const onStateChange = jest.fn()
        const onAddClick = jest.fn()

        render(
            <PhotoViewer
                photos={photos}
                state={{ index: 2, mode: 'single' }}
                onStateChange={onStateChange}
                onAddClick={onAddClick}
            />
        )

        expect(screen.getByTestId('lightbox')).toHaveTextContent('2')

        fireEvent.click(screen.getByRole('button', { name: /Все фото/ }))
        expect(onStateChange).toHaveBeenLastCalledWith({ index: 2, mode: 'grid' })

        fireEvent.click(screen.getByRole('button', { name: /Добавить фото/ }))
        expect(onAddClick).toHaveBeenCalled()
        expect(onStateChange).toHaveBeenLastCalledWith(null)
    })
})
