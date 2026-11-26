import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'

import { CollectionPlacesList } from './CollectionPlacesList'

jest.mock('simple-react-ui-kit', () => ({
    Button: ({ label, onClick, disabled, children, tooltip, className }: any) => (
        <button
            disabled={disabled}
            aria-label={label ?? tooltip}
            className={className}
            onClick={onClick}
        >
            {label ?? children}
        </button>
    ),
    Icon: ({ name }: { name: string }) => <i data-testid={`icon-${name}`} />,
    cn: (...args: unknown[]) => args.filter(Boolean).join(' ')
}))

jest.mock('next/image', () => {
    const Image = ({ src, alt }: any) => (
        <img
            src={src}
            alt={alt}
        />
    )
    Image.displayName = 'Image'
    return Image
})

jest.mock('next/link', () => {
    const Link = ({ href, children, className }: any) => (
        <a
            href={href}
            className={className}
        >
            {children}
        </a>
    )
    Link.displayName = 'Link'
    return Link
})

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => (opts?.defaultValue as string) ?? key
    })
}))

jest.mock('@/components/shared', () => ({
    EmptyState: ({ title, description, action }: any) => (
        <div>
            <strong>{title}</strong>
            <span>{description}</span>
            {action}
        </div>
    )
}))

jest.mock('next/dynamic', () => () => {
    const MockConfirmationDialog = ({ open, message, onConfirm, onCancel }: any) =>
        open ? (
            <div role={'dialog'}>
                <p>{message}</p>
                <button onClick={onConfirm}>confirm</button>
                <button onClick={onCancel}>dismiss</button>
            </div>
        ) : null
    MockConfirmationDialog.displayName = 'MockConfirmationDialog'
    return MockConfirmationDialog
})

jest.mock('@/config/env', () => ({ IMG_HOST: 'https://img.test/' }))

const place = (id: string, title: string, extra: Partial<ApiModel.CollectionPlace> = {}): ApiModel.CollectionPlace =>
    ({
        id,
        title,
        lat: 51,
        lon: 55,
        ...extra
    }) as ApiModel.CollectionPlace

const places = [place('p1', 'Первое'), place('p2', 'Второе', { note: 'Заметка про второе' }), place('p3', 'Третье')]

describe('CollectionPlacesList', () => {
    it('renders places as tiles with links to the place pages, without numbers or notes', () => {
        render(<CollectionPlacesList places={places} />)

        expect(screen.getByRole('link', { name: 'Первое' })).toHaveAttribute('href', '/places/p1')
        expect(screen.getByRole('link', { name: 'Третье' })).toHaveAttribute('href', '/places/p3')
        expect(screen.queryByText('1')).not.toBeInTheDocument()
        expect(screen.queryByText('Заметка про второе')).not.toBeInTheDocument()
    })

    it('shows no controls for readers', () => {
        render(<CollectionPlacesList places={places} />)

        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('shows the "add places" action after the list for the owner outside edit mode', () => {
        const onAddPlaces = jest.fn()

        render(
            <CollectionPlacesList
                places={places}
                canAdd
                onAddPlaces={onAddPlaces}
            />
        )

        expect(screen.getAllByRole('button')).toHaveLength(1)

        fireEvent.click(screen.getByRole('button', { name: 'Добавить места' }))

        expect(onAddPlaces).toHaveBeenCalled()
    })

    it('shows the reader empty state without a call to action', () => {
        render(<CollectionPlacesList places={[]} />)

        expect(screen.getByText('В коллекции пока нет мест')).toBeInTheDocument()
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('shows the owner empty state with an "add places" action outside edit mode', () => {
        const onAddPlaces = jest.fn()

        render(
            <CollectionPlacesList
                places={[]}
                canAdd
                onAddPlaces={onAddPlaces}
            />
        )

        expect(screen.getByText('Добавьте первое место — через поиск или из рекомендаций по теме')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Добавить места' }))

        expect(onAddPlaces).toHaveBeenCalled()
    })

    it('shows the owner empty state with an "add places" action', () => {
        const onAddPlaces = jest.fn()

        render(
            <CollectionPlacesList
                places={[]}
                editable
                onAddPlaces={onAddPlaces}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: 'Добавить места' }))

        expect(onAddPlaces).toHaveBeenCalled()
    })

    it('moves a place and reports the new order', () => {
        const onReorder = jest.fn()

        render(
            <CollectionPlacesList
                places={places}
                editable
                onReorder={onReorder}
            />
        )

        const upButtons = screen.getAllByRole('button', { name: 'Переместить раньше' })
        const downButtons = screen.getAllByRole('button', { name: 'Переместить позже' })

        expect(upButtons[0]).toBeDisabled()
        expect(downButtons[2]).toBeDisabled()

        fireEvent.click(downButtons[0])

        expect(onReorder).toHaveBeenCalledWith(['p2', 'p1', 'p3'])
    })

    it('asks for confirmation before removing a place', () => {
        const onRemove = jest.fn()

        render(
            <CollectionPlacesList
                places={places}
                editable
                onRemove={onRemove}
            />
        )

        fireEvent.click(screen.getAllByRole('button', { name: 'Удалить из коллекции' })[2])

        expect(screen.getByRole('dialog')).toHaveTextContent('Удалить «{{title}}» из коллекции?')
        expect(onRemove).not.toHaveBeenCalled()

        fireEvent.click(screen.getByText('confirm'))

        expect(onRemove).toHaveBeenCalledWith('p3')
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
})
