import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'

import { API } from '@/api'

import { PlaceActivity } from './PlaceActivity'

jest.mock('simple-react-ui-kit', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Button: ({ label, children, onClick }: any) => (
        <button
            type={'button'}
            onClick={onClick}
        >
            {label ?? children}
        </button>
    ),
    Icon: ({ name }: { name: string }) => <i data-testid={`icon-${name}`} />,
    cn: (...args: unknown[]) => args.filter(Boolean).join(' ')
}))

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => (opts?.defaultValue as string) ?? key
    })
}))

jest.mock('@/components/shared', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Section: ({ title, children }: any) => (
        <section>
            <h2>{title}</h2>
            {children}
        </section>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    FeedList: ({ stories, density, hidePlace, footer }: any) => (
        <div>
            <ul
                data-testid={'feed-list'}
                data-density={density}
                data-hide-place={String(hidePlace)}
            >
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {stories.map((story: any) => (
                    <li key={story.id}>{story.type}</li>
                ))}
            </ul>
            {footer}
        </div>
    )
}))

jest.mock('@/api', () => ({
    API: { useFeedGetListInfiniteQuery: jest.fn(), useFeedGetStoriesQuery: jest.fn() }
}))

const useCount = jest.mocked(API.useFeedGetStoriesQuery)
const useList = jest.mocked(API.useFeedGetListInfiniteQuery)

describe('PlaceActivity', () => {
    const fetchNextPage = jest.fn()

    const listResult = (hasNextPage: boolean) => ({
        data: {
            pageParams: [''],
            pages: [
                {
                    count: 14,
                    items: [
                        { id: 's1', type: 'photo' },
                        { id: 's2', type: 'edit' }
                    ]
                }
            ]
        },
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage: false,
        isLoading: false
    })

    beforeEach(() => {
        fetchNextPage.mockReset()
        useCount.mockReturnValue({ data: { count: 14, items: [] } } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        useList.mockImplementation(((args: unknown, opts?: { skip?: boolean }) =>
            opts?.skip ? { data: undefined, hasNextPage: false } : listResult(false)) as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    })

    it('renders collapsed with the count and loads the history only on click', () => {
        render(<PlaceActivity placeId={'p1'} />)

        expect(screen.getByRole('heading', { name: /Журнал активности/ })).toBeInTheDocument()

        const toggle = screen.getByRole('button', { name: /Журнал активности/ })

        expect(toggle).toHaveAttribute('aria-expanded', 'false')
        expect(toggle).toHaveTextContent('14')
        expect(screen.queryByTestId('feed-list')).toBeNull()
        expect(useList.mock.calls.every(([, opts]) => opts?.skip)).toBe(true)
        expect(useCount).toHaveBeenCalledWith({ countOnly: true, place: 'p1' }, { skip: false })

        fireEvent.click(toggle)

        expect(toggle).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByTestId('feed-list')).toHaveAttribute('data-density', 'compact')
        expect(screen.getByTestId('feed-list')).toHaveAttribute('data-hide-place', 'true')
        expect(screen.getAllByRole('listitem')).toHaveLength(2)
        expect(useList).toHaveBeenLastCalledWith({ limit: 10, place: 'p1' }, { skip: false })
    })

    it('loads the next page with "show more"', () => {
        useList.mockImplementation((() => listResult(true)) as any) // eslint-disable-line @typescript-eslint/no-explicit-any

        render(<PlaceActivity placeId={'p1'} />)
        fireEvent.click(screen.getByRole('button', { name: /Журнал активности/ }))
        fireEvent.click(screen.getByRole('button', { name: 'show-more' }))

        expect(fetchNextPage).toHaveBeenCalledTimes(1)
    })

    it('has no "show more" on the last page', () => {
        render(<PlaceActivity placeId={'p1'} />)
        fireEvent.click(screen.getByRole('button', { name: /Журнал активности/ }))

        expect(screen.queryByRole('button', { name: 'show-more' })).toBeNull()
    })

    it('skips both requests without a place', () => {
        render(<PlaceActivity />)

        expect(useCount).toHaveBeenCalledWith({ countOnly: true, place: undefined }, { skip: true })
    })
})
