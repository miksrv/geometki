import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { API } from '@/api'

import { AddToCollectionModal } from './AddToCollectionModal'

jest.mock('simple-react-ui-kit', () => ({
    Button: ({ label, onClick, disabled, loading, children }: any) => (
        <button
            disabled={disabled || loading}
            onClick={onClick}
        >
            {label ?? children}
        </button>
    ),
    Checkbox: ({ id, checked, disabled, onChange }: any) => (
        <input
            type={'checkbox'}
            id={id}
            checked={!!checked}
            disabled={disabled}
            onChange={onChange}
        />
    ),
    Dialog: ({ open, children }: any) => (open ? <div role={'dialog'}>{children}</div> : null),
    Input: ({ placeholder, value, onChange, onKeyDown, maxLength }: any) => (
        <input
            placeholder={placeholder}
            value={value}
            maxLength={maxLength}
            onChange={onChange}
            onKeyDown={onKeyDown}
        />
    ),
    Skeleton: () => <div data-testid={'skeleton'} />
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
    const Link = ({ href, children }: any) => <a href={href}>{children}</a>
    Link.displayName = 'Link'
    return Link
})

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => opts?.defaultValue ?? key
    })
}))

jest.mock('@/api', () => ({
    API: {
        useCollectionsGetMembershipQuery: jest.fn(),
        useCollectionsAddPlacesMutation: jest.fn(),
        useCollectionsRemovePlaceMutation: jest.fn(),
        useCollectionsPostMutation: jest.fn()
    }
}))

jest.mock('@/app/store', () => ({
    useAppDispatch: () => jest.fn()
}))

jest.mock('@/app/notificationSlice', () => ({
    Notify: jest.fn((payload: unknown) => ({ type: 'notification/Notify', payload }))
}))

const membershipItems = [
    { id: 'col-1', title: 'Водопады', placesCount: 3, cover: null, contains: false },
    { id: 'col-2', title: 'Пещеры', placesCount: 1, cover: null, contains: true }
]

describe('AddToCollectionModal', () => {
    const addPlaces = jest.fn().mockResolvedValue({ data: {} })
    const removePlace = jest.fn().mockResolvedValue({ data: {} })
    const createCollection = jest.fn().mockResolvedValue({ data: { id: 'col-new', slug: 'new' } })

    beforeEach(() => {
        jest.clearAllMocks()
        addPlaces.mockResolvedValue({ data: {} })
        removePlace.mockResolvedValue({ data: {} })
        createCollection.mockResolvedValue({ data: { id: 'col-new', slug: 'new' } })

        jest.mocked(API.useCollectionsGetMembershipQuery).mockReturnValue({
            data: { items: membershipItems },
            isLoading: false,
            refetch: jest.fn()
        })
        jest.mocked(API.useCollectionsAddPlacesMutation).mockReturnValue([
            addPlaces,
            { isLoading: false, reset: jest.fn() }
        ])
        jest.mocked(API.useCollectionsRemovePlaceMutation).mockReturnValue([
            removePlace,
            { isLoading: false, reset: jest.fn() }
        ])
        jest.mocked(API.useCollectionsPostMutation).mockReturnValue([
            createCollection,
            { isLoading: false, reset: jest.fn() }
        ])
    })

    it('does not render when closed', () => {
        render(
            <AddToCollectionModal
                placeId={'place-1'}
                open={false}
                onClose={jest.fn()}
            />
        )

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('renders the user collections with their checked state', () => {
        render(
            <AddToCollectionModal
                placeId={'place-1'}
                open={true}
                onClose={jest.fn()}
            />
        )

        expect(screen.getByText('Водопады')).toBeInTheDocument()
        expect(screen.getByText('Пещеры')).toBeInTheDocument()

        const checkboxes = screen.getAllByRole('checkbox')
        expect(checkboxes[0]).not.toBeChecked()
        expect(checkboxes[1]).toBeChecked()
    })

    it('shows skeleton rows while loading', () => {
        jest.mocked(API.useCollectionsGetMembershipQuery).mockReturnValue({
            data: undefined,
            isLoading: true,
            refetch: jest.fn()
        })

        render(
            <AddToCollectionModal
                placeId={'place-1'}
                open={true}
                onClose={jest.fn()}
            />
        )

        expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0)
    })

    it('adds the place to a collection that does not contain it yet', () => {
        render(
            <AddToCollectionModal
                placeId={'place-1'}
                open={true}
                onClose={jest.fn()}
            />
        )

        const checkboxes = screen.getAllByRole('checkbox')
        fireEvent.click(checkboxes[0])

        expect(addPlaces).toHaveBeenCalledWith({ id: 'col-1', placeIds: ['place-1'] })
    })

    it('toggles the collection when clicking anywhere in the row (44px touch target)', () => {
        render(
            <AddToCollectionModal
                placeId={'place-1'}
                open={true}
                onClose={jest.fn()}
            />
        )

        fireEvent.click(screen.getByText('Водопады'))

        expect(addPlaces).toHaveBeenCalledWith({ id: 'col-1', placeIds: ['place-1'] })
    })

    it('removes the place from a collection that already contains it', () => {
        render(
            <AddToCollectionModal
                placeId={'place-1'}
                open={true}
                onClose={jest.fn()}
            />
        )

        const checkboxes = screen.getAllByRole('checkbox')
        fireEvent.click(checkboxes[1])

        expect(removePlace).toHaveBeenCalledWith({ id: 'col-2', placeId: 'place-1' })
    })

    it('filters the list by the search input', () => {
        render(
            <AddToCollectionModal
                placeId={'place-1'}
                open={true}
                onClose={jest.fn()}
            />
        )

        fireEvent.change(screen.getByPlaceholderText('Поиск по вашим коллекциям'), {
            target: { value: 'пещер' }
        })

        expect(screen.queryByText('Водопады')).not.toBeInTheDocument()
        expect(screen.getByText('Пещеры')).toBeInTheDocument()
    })

    it('creates a new collection and adds the place to it', async () => {
        render(
            <AddToCollectionModal
                placeId={'place-1'}
                open={true}
                onClose={jest.fn()}
            />
        )

        fireEvent.change(screen.getByPlaceholderText('+ Новая коллекция'), {
            target: { value: 'Новая коллекция' }
        })
        fireEvent.click(screen.getByText('Создать'))

        await Promise.resolve()
        await Promise.resolve()

        expect(createCollection).toHaveBeenCalledWith({ title: 'Новая коллекция' })
        expect(addPlaces).toHaveBeenCalledWith({ id: 'col-new', placeIds: ['place-1'] })
    })

    it('shows a link to the newly created collection only after creating it', async () => {
        render(
            <AddToCollectionModal
                placeId={'place-1'}
                open={true}
                onClose={jest.fn()}
            />
        )

        expect(screen.queryByText('Открыть и дописать описание')).not.toBeInTheDocument()

        fireEvent.change(screen.getByPlaceholderText('+ Новая коллекция'), {
            target: { value: 'Новая коллекция' }
        })
        fireEvent.click(screen.getByText('Создать'))

        expect(await screen.findByText('Открыть и дописать описание')).toHaveAttribute(
            'href',
            '/collections/col-new-new'
        )
    })
})
