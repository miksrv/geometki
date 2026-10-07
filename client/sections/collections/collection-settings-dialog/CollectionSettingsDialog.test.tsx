import React from 'react'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { API, ApiModel } from '@/api'

import { CollectionSettingsDialog } from './CollectionSettingsDialog'

jest.mock('simple-react-ui-kit', () => ({
    Button: ({ label, onClick, disabled, loading, children }: any) => (
        <button
            disabled={disabled || loading}
            onClick={onClick}
        >
            {label ?? children}
        </button>
    ),
    Dialog: ({ open, title, children }: any) =>
        open ? (
            <div role={'dialog'}>
                <h2>{title}</h2>
                {children}
            </div>
        ) : null,
    Input: ({ label, value, onChange, maxLength }: any) => (
        <label>
            {label}
            <input
                value={value}
                maxLength={maxLength}
                onChange={onChange}
            />
        </label>
    ),
    Select: ({ label, value, options, onSelect }: any) => (
        <label>
            {label}
            <select
                value={value ?? ''}
                onChange={(event) =>
                    onSelect(event.target.value ? [options.find((o: any) => o.key === event.target.value)] : undefined)
                }
            >
                <option value={''}>—</option>
                {options.map((option: any) => (
                    <option
                        key={option.key}
                        value={option.key}
                    >
                        {option.value}
                    </option>
                ))}
            </select>
        </label>
    ),
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
        useCollectionsPatchMutation: jest.fn(),
        useCategoriesGetListQuery: jest.fn(),
        useLocationGetSearchMutation: jest.fn()
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

const collection: ApiModel.Collection = {
    id: 'col-1',
    slug: 'gory',
    title: 'Горы',
    author: { id: 'u1', name: 'Alice' },
    region: { id: 7, name: 'Алтай' },
    placesCount: 2,
    views: 0,
    saves: 0,
    featured: false,
    updated: { date: '2026-10-06T12:00:00+00:00', timezone_type: 3, timezone: 'UTC' },
    created: { date: '2026-10-06T12:00:00+00:00', timezone_type: 3, timezone: 'UTC' },
    places: [
        { id: 'p1', title: 'Белуха', lat: 1, lon: 1, cover: { preview: 'p1-preview.jpg' } },
        { id: 'p2', title: 'Телецкое', lat: 1, lon: 1, cover: { preview: 'p2-preview.jpg' } }
    ] as ApiModel.CollectionPlace[]
}

describe('CollectionSettingsDialog', () => {
    const patchCollection = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
        patchCollection.mockResolvedValue({ data: {} })
        jest.mocked(API.useCollectionsPatchMutation).mockReturnValue([patchCollection, { isLoading: false } as any])
        jest.mocked(API.useCategoriesGetListQuery).mockReturnValue({
            data: {
                items: [
                    { name: 'mountain', title: 'Горы' },
                    { name: 'cave', title: 'Пещеры' }
                ]
            }
        } as any)
        jest.mocked(API.useLocationGetSearchMutation).mockReturnValue([jest.fn(), { data: undefined } as any])
    })

    const renderDialog = (onClose = jest.fn(), onDelete = jest.fn()) =>
        render(
            <CollectionSettingsDialog
                collection={collection}
                open={true}
                onClose={onClose}
                onDelete={onDelete}
            />
        )

    it('keeps "save" disabled until something changes', () => {
        renderDialog()

        expect(screen.getByText('save')).toBeDisabled()

        fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Горы Алтая' } })

        expect(screen.getByText('save')).toBeEnabled()
    })

    it('disables "save" for an empty title', () => {
        renderDialog()

        fireEvent.change(screen.getByLabelText('Название'), { target: { value: '   ' } })

        expect(screen.getByText('save')).toBeDisabled()
    })

    it('saves the trimmed title', async () => {
        renderDialog()

        fireEvent.change(screen.getByLabelText('Название'), { target: { value: '  Горы Алтая ' } })
        fireEvent.click(screen.getByText('save'))

        await waitFor(() => expect(patchCollection).toHaveBeenCalled())

        expect(patchCollection).toHaveBeenCalledWith({
            id: 'col-1',
            region: 7,
            title: 'Горы Алтая'
        })
    })

    it('stays open and notifies on a failed save', async () => {
        const onClose = jest.fn()
        patchCollection.mockResolvedValue({ error: { status: 400, data: { messages: { error: 'Нельзя' } } } })
        renderDialog(onClose)

        fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Новое' } })
        fireEvent.click(screen.getByText('save'))

        await waitFor(() =>
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ payload: expect.objectContaining({ type: 'error' }) })
            )
        )
        expect(onClose).not.toHaveBeenCalled()
    })

    it('shows the saved region', () => {
        renderDialog()

        expect(screen.getByLabelText('Регион')).toHaveValue('7')
        expect(screen.getByText('Алтай')).toBeInTheDocument()
    })

    it('saves a region picked from the search results', async () => {
        jest.mocked(API.useLocationGetSearchMutation).mockReturnValue([
            jest.fn(),
            { data: { regions: [{ id: 12, name: 'Карелия' }] } } as any
        ])
        renderDialog()

        fireEvent.change(screen.getByLabelText('Регион'), { target: { value: '12' } })
        fireEvent.click(screen.getByText('save'))

        await waitFor(() => expect(patchCollection).toHaveBeenCalled())

        expect(screen.getByLabelText('Регион')).toHaveValue('12')
        expect(patchCollection).toHaveBeenCalledWith({ id: 'col-1', region: 12, title: 'Горы' })
    })

    it('hands the delete action to the parent', () => {
        const onDelete = jest.fn()
        renderDialog(jest.fn(), onDelete)

        fireEvent.click(screen.getByText('Удалить коллекцию'))

        expect(onDelete).toHaveBeenCalled()
    })
})
