import React from 'react'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'

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
    Icon: ({ name }: { name: string }) => <i data-testid={`icon-${name}`} />,
    Input: ({ placeholder, value, onChange, onKeyDown, maxLength, disabled }: any) => (
        <input
            placeholder={placeholder}
            value={value}
            maxLength={maxLength}
            disabled={disabled}
            onChange={onChange}
            onKeyDown={onKeyDown}
        />
    ),
    Skeleton: () => <div data-testid={'skeleton'} />,
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

const mockDispatch = jest.fn()

jest.mock('@/app/store', () => ({
    useAppDispatch: () => mockDispatch
}))

jest.mock('@/app/notificationSlice', () => ({
    Notify: jest.fn((payload: unknown) => ({ type: 'notification/Notify', payload }))
}))

const membershipItems = [
    { id: 'col-1', title: 'Водопады', placesCount: 3, cover: null, contains: false },
    { id: 'col-2', title: 'Пещеры', placesCount: 1, cover: null, contains: true }
]

const manyItems = Array.from({ length: 8 }, (_, i) => ({
    id: `col-${i}`,
    title: `Коллекция ${i}`,
    placesCount: i,
    cover: null,
    contains: false
}))

const SEARCH_PLACEHOLDER = 'Поиск по вашим коллекциям'
const TITLE_PLACEHOLDER = 'Например, Водопады Карелии'

const renderModal = (open = true) =>
    render(
        <AddToCollectionModal
            placeId={'place-1'}
            open={open}
            onClose={jest.fn()}
        />
    )

describe('AddToCollectionModal', () => {
    const addPlaces = jest.fn()
    const removePlace = jest.fn()
    const createCollection = jest.fn()

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
        renderModal(false)

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('renders the user collections with their checked state', () => {
        renderModal()

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

        renderModal()

        expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0)
    })

    it('adds the place to a collection that does not contain it yet', () => {
        renderModal()

        fireEvent.click(screen.getAllByRole('checkbox')[0])

        expect(addPlaces).toHaveBeenCalledWith({ id: 'col-1', placeIds: ['place-1'] })
    })

    it('toggles the collection when clicking anywhere in the row', () => {
        renderModal()

        fireEvent.click(screen.getByText('Водопады'))

        expect(addPlaces).toHaveBeenCalledWith({ id: 'col-1', placeIds: ['place-1'] })
    })

    it('removes the place from a collection that already contains it', () => {
        renderModal()

        fireEvent.click(screen.getAllByRole('checkbox')[1])

        expect(removePlace).toHaveBeenCalledWith({ id: 'col-2', placeId: 'place-1' })
    })

    it('hides the search for a short list', () => {
        renderModal()

        expect(screen.queryByPlaceholderText(SEARCH_PLACEHOLDER)).not.toBeInTheDocument()
    })

    it('filters a long list by the search input', () => {
        jest.mocked(API.useCollectionsGetMembershipQuery).mockReturnValue({
            data: { items: manyItems },
            isLoading: false,
            refetch: jest.fn()
        })

        renderModal()

        fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), { target: { value: 'коллекция 7' } })

        expect(screen.getByText('Коллекция 7')).toBeInTheDocument()
        expect(screen.queryByText('Коллекция 1')).not.toBeInTheDocument()
    })

    it('shows "nothing found" when the search has no matches', () => {
        jest.mocked(API.useCollectionsGetMembershipQuery).mockReturnValue({
            data: { items: manyItems },
            isLoading: false,
            refetch: jest.fn()
        })

        renderModal()

        fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), { target: { value: 'зомби' } })

        expect(screen.getByText('Ничего не найдено')).toBeInTheDocument()
    })

    it('keeps the create form collapsed behind a single button', () => {
        renderModal()

        expect(screen.queryByPlaceholderText(TITLE_PLACEHOLDER)).not.toBeInTheDocument()

        fireEvent.click(screen.getByText('Новая коллекция'))

        expect(screen.getByPlaceholderText(TITLE_PLACEHOLDER)).toBeInTheDocument()
        expect(screen.getByText('Создать')).toBeDisabled()

        fireEvent.click(screen.getByText('cancel'))

        expect(screen.queryByPlaceholderText(TITLE_PLACEHOLDER)).not.toBeInTheDocument()
    })

    it('creates a new collection, adds the place to it and collapses the form', async () => {
        renderModal()

        fireEvent.click(screen.getByText('Новая коллекция'))
        fireEvent.change(screen.getByPlaceholderText(TITLE_PLACEHOLDER), { target: { value: '  Горы  ' } })
        fireEvent.click(screen.getByText('Создать'))

        await waitFor(() => expect(addPlaces).toHaveBeenCalledWith({ id: 'col-new', placeIds: ['place-1'] }))

        expect(createCollection).toHaveBeenCalledWith({ title: 'Горы' })
        await waitFor(() => expect(screen.queryByPlaceholderText(TITLE_PLACEHOLDER)).not.toBeInTheDocument())

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                payload: expect.objectContaining({
                    type: 'success',
                    collection: { id: 'col-new', slug: 'new', title: 'Горы' }
                })
            })
        )
    })

    it('submits the new collection on Enter', async () => {
        renderModal()

        fireEvent.click(screen.getByText('Новая коллекция'))
        fireEvent.change(screen.getByPlaceholderText(TITLE_PLACEHOLDER), { target: { value: 'Горы' } })
        fireEvent.keyDown(screen.getByPlaceholderText(TITLE_PLACEHOLDER), { key: 'Enter' })

        await waitFor(() => expect(createCollection).toHaveBeenCalledWith({ title: 'Горы' }))
    })

    it('opens the create form right away when the user has no collections', () => {
        jest.mocked(API.useCollectionsGetMembershipQuery).mockReturnValue({
            data: { items: [] },
            isLoading: false,
            refetch: jest.fn()
        })

        renderModal()

        expect(screen.getByText('У вас пока нет коллекций')).toBeInTheDocument()
        expect(screen.getByPlaceholderText(TITLE_PLACEHOLDER)).toBeInTheDocument()
        expect(screen.queryByText('cancel')).not.toBeInTheDocument()
    })
})
