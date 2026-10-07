import React from 'react'

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { API, ApiModel } from '@/api'

import { AddPlacesDialog } from './AddPlacesDialog'

jest.mock('simple-react-ui-kit', () => ({
    Button: ({ label, onClick, disabled, loading, children, role, 'aria-selected': selected }: any) => (
        <button
            role={role}
            aria-selected={selected}
            disabled={disabled || loading}
            onClick={onClick}
        >
            {label ?? children}
        </button>
    ),
    Dialog: ({ open, children }: any) => (open ? <div role={'dialog'}>{children}</div> : null),
    Icon: ({ name }: { name: string }) => <i data-testid={`icon-${name}`} />,
    Input: ({ placeholder, value, onChange }: any) => (
        <input
            placeholder={placeholder}
            value={value}
            onChange={onChange}
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
        t: (key: string, opts?: Record<string, unknown>) => (opts?.defaultValue as string) ?? key
    })
}))

jest.mock('@/api', () => ({
    API: {
        useCollectionsAddPlacesMutation: jest.fn(),
        usePlacesGetListQuery: jest.fn(),
        useCollectionsGetRecommendedQuery: jest.fn()
    }
}))

const mockDispatch = jest.fn()

jest.mock('@/app/store', () => ({
    useAppDispatch: () => mockDispatch
}))

jest.mock('@/app/notificationSlice', () => ({
    Notify: jest.fn((payload: unknown) => ({ type: 'notification/Notify', payload }))
}))

jest.mock('@/config/env', () => ({ IMG_HOST: 'https://img.test/' }))

const collection = {
    id: 'col-1',
    title: 'Горы',
    region: { id: 7, name: 'Алтай' },
    places: [{ id: 'p1', title: 'Белуха', lat: 1, lon: 1 }]
} as unknown as ApiModel.Collection

const found = [
    { id: 'p1', title: 'Белуха', lat: 1, lon: 1 },
    { id: 'p9', title: 'Белокуриха', lat: 1, lon: 1 }
] as ApiModel.Place[]

describe('AddPlacesDialog', () => {
    const addPlaces = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
        addPlaces.mockResolvedValue({ data: {} })
        jest.mocked(API.useCollectionsAddPlacesMutation).mockReturnValue([addPlaces, { isLoading: false } as any])
        jest.mocked(API.usePlacesGetListQuery).mockReturnValue({ data: { items: found }, isFetching: false } as any)
        jest.mocked(API.useCollectionsGetRecommendedQuery).mockReturnValue({
            data: { items: found },
            isFetching: false
        } as any)
    })

    const renderDialog = () =>
        render(
            <AddPlacesDialog
                collection={collection}
                open={true}
                onClose={jest.fn()}
            />
        )

    it('asks for at least two characters before searching', () => {
        renderDialog()

        expect(screen.getByText('Введите не менее 2 символов')).toBeInTheDocument()
        expect(jest.mocked(API.usePlacesGetListQuery).mock.calls.at(-1)?.[1]).toMatchObject({ skip: true })
    })

    it('lists search results without the places already in the collection and adds one', async () => {
        jest.useFakeTimers()
        renderDialog()

        fireEvent.change(screen.getByPlaceholderText('Начните вводить название места'), { target: { value: 'Бел' } })

        // The query is debounced: nothing is requested until the user pauses
        expect(jest.mocked(API.usePlacesGetListQuery).mock.calls.at(-1)?.[1]).toMatchObject({ skip: true })

        act(() => {
            jest.advanceTimersByTime(300)
        })
        jest.useRealTimers()

        expect(jest.mocked(API.usePlacesGetListQuery).mock.calls.at(-1)?.[0]).toMatchObject({ search: 'Бел' })
        expect(screen.getByText('Белокуриха')).toBeInTheDocument()
        expect(screen.queryByText('Белуха')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Добавить' }))

        await waitFor(() => expect(addPlaces).toHaveBeenCalledWith({ id: 'col-1', placeIds: ['p9'] }))
    })

    it('adds all recommended places that are not in the collection yet', async () => {
        jest.mocked(API.useCollectionsGetRecommendedQuery).mockReturnValue({
            data: { items: [...found, { id: 'p10', title: 'Чемал', lat: 1, lon: 1 }] },
            isFetching: false
        } as any)

        renderDialog()

        fireEvent.click(screen.getByRole('tab', { name: 'Рекомендуем' }))
        fireEvent.click(screen.getByRole('button', { name: 'Добавить все ({{count}})' }))

        await waitFor(() => expect(addPlaces).toHaveBeenCalledWith({ id: 'col-1', placeIds: ['p9', 'p10'] }))
    })

    it('keeps the previous results on screen while the next search is loading', () => {
        jest.mocked(API.usePlacesGetListQuery).mockReturnValue({
            data: { items: found },
            isFetching: true,
            isLoading: false
        } as any)

        jest.useFakeTimers()
        renderDialog()
        fireEvent.change(screen.getByPlaceholderText('Начните вводить название места'), { target: { value: 'Бел' } })
        act(() => {
            jest.advanceTimersByTime(300)
        })
        jest.useRealTimers()

        expect(screen.getByText('Белокуриха')).toBeInTheDocument()
        expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument()
    })

    it('explains how to get recommendations when the collection has no region and skips the request', () => {
        jest.mocked(API.useCollectionsGetRecommendedQuery).mockReturnValue({ data: { items: [] } } as any)

        render(
            <AddPlacesDialog
                collection={{ ...collection, region: null }}
                open={true}
                onClose={jest.fn()}
            />
        )

        fireEvent.click(screen.getByRole('tab', { name: 'Рекомендуем' }))

        expect(screen.getByText(/Укажите регион в настройках/)).toBeInTheDocument()
        expect(screen.getByText('Пока нечего порекомендовать')).toBeInTheDocument()
        expect(jest.mocked(API.useCollectionsGetRecommendedQuery).mock.calls.at(-1)?.[1]).toMatchObject({
            skip: true
        })
    })
})
