import React from 'react'

import { act, fireEvent, render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'

import { UsersListing } from './UsersListing'

const mockLoadPage = jest.fn()

jest.mock('@/api', () => ({
    API: { useLazyUsersGetListQuery: () => [mockLoadPage, { isFetching: false }] }
}))

jest.mock('simple-react-ui-kit', () => ({
    Button: ({ label, onClick }: { label: string; onClick: () => void }) => (
        <button
            type={'button'}
            onClick={onClick}
        >
            {label}
        </button>
    )
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string, values?: Record<string, unknown>) =>
            (fallback ?? key).replace(/{{(\w+)}}/g, (_, name: string) => String(values?.[name]))
    })
}))

jest.mock('@/components/shared', () => ({
    EmptyState: ({ title }: { title: string }) => <p>{title}</p>,
    PaginationBar: () => null,
    UserCard: ({ user, rank }: { user: ApiModel.User; rank?: number }) => (
        <div data-testid={'card'}>{`${user.id}${rank ? ` #${rank}` : ''}`}</div>
    )
}))

const users = (...ids: string[]) => ids.map((id) => ({ id, name: id }) as ApiModel.User)

const cards = () => screen.getAllByTestId('card').map((card) => card.textContent)

describe('UsersListing', () => {
    beforeEach(() => mockLoadPage.mockReset())

    it('says nobody was found for an empty list', () => {
        render(
            <UsersListing
                users={[]}
                count={0}
                currentPage={1}
                perPage={2}
                request={{}}
            />
        )

        expect(screen.getByText('Никого не нашли')).toBeInTheDocument()
    })

    it('numbers a ranking from the first place of the page', () => {
        render(
            <UsersListing
                users={users('a', 'b')}
                count={10}
                currentPage={3}
                perPage={2}
                request={{}}
                ranked={true}
            />
        )

        expect(cards()).toEqual(['a #5', 'b #6'])
    })

    it('appends the next page without the people already shown', async () => {
        mockLoadPage.mockResolvedValue({ data: { items: users('b', 'c') } })

        render(
            <UsersListing
                users={users('a', 'b')}
                count={6}
                currentPage={1}
                perPage={2}
                request={{ sort: 'activity_at' }}
            />
        )

        await act(async () => fireEvent.click(screen.getByText('Показать ещё 2')))

        expect(mockLoadPage).toHaveBeenCalledWith({ limit: 2, offset: 2, sort: 'activity_at' })
        expect(cards()).toEqual(['a', 'b', 'c'])
        expect(screen.getByText('Страница 2 из 3')).toBeInTheDocument()
    })
})
