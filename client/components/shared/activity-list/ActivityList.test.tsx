import React from 'react'

import { render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'

import { ActivityList } from './ActivityList'

jest.mock('simple-react-ui-kit', () => ({
    Container: ({ children, className }: any) => <div className={className}>{children}</div>,
    Skeleton: ({ style }: any) => (
        <div
            data-testid={'skeleton'}
            style={style}
        />
    )
}))

jest.mock('next-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => opts?.defaultValue ?? key
    })
}))

jest.mock('./ActivityListItem', () => ({
    ActivityListItem: ({ item, title }: any) => (
        <div
            data-testid={'activity-list-item'}
            data-title={title}
        >
            {item.type}
        </div>
    )
}))

jest.mock('./ActivityListItemLoader', () => ({
    ActivityListItemLoader: () => <div data-testid={'activity-loader'} />
}))

const mockActivities: ApiModel.Activity[] = [
    { type: 'place', place: { id: 'p1', title: 'Place 1', lat: 0, lon: 0 } },
    { type: 'photo', place: { id: 'p2', title: 'Place 2', lat: 0, lon: 0 } }
]

describe('ActivityList', () => {
    describe('rendering', () => {
        it('renders activity items when activities are provided', () => {
            render(<ActivityList activities={mockActivities} />)
            expect(screen.getAllByTestId('activity-list-item')).toHaveLength(2)
        })

        it('renders first item with title when title prop is provided', () => {
            render(
                <ActivityList
                    activities={mockActivities}
                    title={'Latest Activity'}
                />
            )
            const items = screen.getAllByTestId('activity-list-item')
            expect(items[0]).toHaveAttribute('data-title', 'Latest Activity')
            // Second item should not have the title
            expect(items[1]).not.toHaveAttribute('data-title', 'Latest Activity')
        })

        it('renders empty state when no activities and not loading', () => {
            render(<ActivityList />)
            expect(screen.getByText('Тут пока ничего нет')).toBeInTheDocument()
        })

        it('does not render empty state when loading', () => {
            render(<ActivityList loading={true} />)
            expect(screen.queryByText('Тут пока ничего нет')).not.toBeInTheDocument()
        })

        it('renders the loader when loading is true', () => {
            render(<ActivityList loading={true} />)
            expect(screen.getByTestId('activity-loader')).toBeInTheDocument()
        })

        it('does not render the loader when loading is false', () => {
            render(
                <ActivityList
                    loading={false}
                    activities={mockActivities}
                />
            )
            expect(screen.queryByTestId('activity-loader')).not.toBeInTheDocument()
        })

        it('renders empty state when activities is an empty array and not loading', () => {
            render(<ActivityList activities={[]} />)
            expect(screen.getByText('Тут пока ничего нет')).toBeInTheDocument()
        })
    })
})
