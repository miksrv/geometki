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
    ActivityList: ({ activities, plain }: any) => (
        <ul
            data-testid={'activity-list'}
            data-plain={String(plain)}
        >
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {activities.map((item: any, index: number) => (
                <li key={index}>{item.type}</li>
            ))}
        </ul>
    )
}))

jest.mock('@/api', () => ({
    API: { useActivityGetListQuery: jest.fn() }
}))

const useList = jest.mocked(API.useActivityGetListQuery)

describe('PlaceActivity', () => {
    // Stable results: the component keeps `data` in an effect's deps, a fresh object per
    // render would loop
    const countResult = { data: { items: [], count: 14 } }
    const skippedResult = { data: undefined, isLoading: false, isFetching: false }
    const listResult = {
        data: { items: [{ type: 'photo' }, { type: 'edit' }], has_more: false, count: 14 },
        isLoading: false,
        isFetching: false
    }

    beforeEach(() => {
        useList.mockImplementation(((args: { limit?: number }, opts?: { skip?: boolean }) =>
            args.limit === 1 ? countResult : opts?.skip ? skippedResult : listResult) as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    })

    it('renders collapsed with the count and loads the list only on click', () => {
        render(<PlaceActivity placeId={'p1'} />)

        const toggle = screen.getByRole('button', { name: /История изменений/ })

        expect(toggle).toHaveAttribute('aria-expanded', 'false')
        expect(toggle).toHaveTextContent('(14)')
        expect(screen.queryByTestId('activity-list')).toBeNull()

        // The list request is skipped while collapsed
        const listCalls = useList.mock.calls.filter(([args]) => (args as { limit?: number })?.limit !== 1)
        expect(listCalls.every(([, opts]) => opts?.skip)).toBe(true)

        fireEvent.click(toggle)

        expect(toggle).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByTestId('activity-list')).toHaveAttribute('data-plain', 'true')
        expect(screen.getAllByRole('listitem')).toHaveLength(2)
    })
})
