import React from 'react'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { API } from '@/api'

import { CreateCollectionDialog } from './CreateCollectionDialog'

jest.mock('simple-react-ui-kit', () => ({
    Button: ({ onClick, disabled, loading, children }: any) => (
        <button
            disabled={disabled || loading}
            onClick={onClick}
        >
            {children}
        </button>
    ),
    Dialog: ({ open, title, children }: any) =>
        open ? (
            <div role={'dialog'}>
                <h2>{title}</h2>
                {children}
            </div>
        ) : null,
    Input: ({ placeholder, value, onChange, onKeyDown, maxLength }: any) => (
        <input
            placeholder={placeholder}
            value={value}
            maxLength={maxLength}
            onChange={onChange}
            onKeyDown={onKeyDown}
        />
    )
}))

const mockPush = jest.fn()

jest.mock('next/router', () => ({
    useRouter: () => ({ push: mockPush })
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => opts?.defaultValue ?? key
    })
}))

jest.mock('@/api', () => ({
    API: {
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

const TITLE_PLACEHOLDER = 'Например, Водопады Карелии'

describe('CreateCollectionDialog', () => {
    const createCollection = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
        createCollection.mockResolvedValue({ data: { id: 'col-new', slug: 'gory' } })
        jest.mocked(API.useCollectionsPostMutation).mockReturnValue([
            createCollection,
            { isLoading: false, reset: jest.fn() }
        ])
    })

    it('does not render when closed', () => {
        render(
            <CreateCollectionDialog
                open={false}
                onClose={jest.fn()}
            />
        )

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('disables the create button until a title is typed', () => {
        render(
            <CreateCollectionDialog
                open={true}
                onClose={jest.fn()}
            />
        )

        expect(screen.getByText('Создать')).toBeDisabled()

        fireEvent.change(screen.getByPlaceholderText(TITLE_PLACEHOLDER), { target: { value: '   ' } })
        expect(screen.getByText('Создать')).toBeDisabled()

        fireEvent.change(screen.getByPlaceholderText(TITLE_PLACEHOLDER), { target: { value: 'Горы' } })
        expect(screen.getByText('Создать')).toBeEnabled()
    })

    it('creates the collection and opens its page', async () => {
        const onClose = jest.fn()

        render(
            <CreateCollectionDialog
                open={true}
                onClose={onClose}
            />
        )

        fireEvent.change(screen.getByPlaceholderText(TITLE_PLACEHOLDER), { target: { value: ' Горы ' } })
        fireEvent.click(screen.getByText('Создать'))

        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/collections/col-new-gory'))

        expect(createCollection).toHaveBeenCalledWith({ title: 'Горы' })
        expect(onClose).toHaveBeenCalled()
        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                payload: expect.objectContaining({
                    type: 'success',
                    collection: { id: 'col-new', slug: 'gory', title: 'Горы' }
                })
            })
        )
    })

    it('calls onCreated instead of navigating when provided', async () => {
        const onCreated = jest.fn()

        render(
            <CreateCollectionDialog
                open={true}
                onClose={jest.fn()}
                onCreated={onCreated}
            />
        )

        fireEvent.change(screen.getByPlaceholderText(TITLE_PLACEHOLDER), { target: { value: 'Горы' } })
        fireEvent.keyDown(screen.getByPlaceholderText(TITLE_PLACEHOLDER), { key: 'Enter' })

        await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ id: 'col-new', slug: 'gory', title: 'Горы' }))

        expect(mockPush).not.toHaveBeenCalled()
    })

    it('shows an error notification and stays open when the request fails', async () => {
        const onClose = jest.fn()
        createCollection.mockResolvedValue({ error: { status: 400, data: { messages: { error: 'Лимит' } } } })

        render(
            <CreateCollectionDialog
                open={true}
                onClose={onClose}
            />
        )

        fireEvent.change(screen.getByPlaceholderText(TITLE_PLACEHOLDER), { target: { value: 'Горы' } })
        fireEvent.click(screen.getByText('Создать'))

        await waitFor(() =>
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({ payload: expect.objectContaining({ type: 'error' }) })
            )
        )

        expect(onClose).not.toHaveBeenCalled()
        expect(mockPush).not.toHaveBeenCalled()
    })
})
