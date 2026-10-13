import React from 'react'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

import { render, screen } from '@testing-library/react'

import { ApiModel } from '@/api'

import { FeedList } from './FeedList'

dayjs.extend(utc)

jest.mock('next-i18next/pages', () => ({
    useTranslation: () => ({
        i18n: { language: 'en' },
        t: (key: string, opts?: Record<string, unknown>) => (opts?.defaultValue as string) ?? key
    })
}))

jest.mock('./FeedStory', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    FeedStory: ({ story, density, hidePlace }: any) => (
        <article
            data-testid={'story'}
            data-density={density}
            data-hide-place={String(!!hidePlace)}
        >
            {story.id}
        </article>
    )
}))

jest.mock('./FeedStoryLoader', () => ({
    FeedStoryLoader: () => <div data-testid={'loader'} />
}))

const story = (id: string, updated: string): ApiModel.FeedStory => ({
    count: 1,
    created: { date: updated, timezone: 'UTC', timezone_type: 3 },
    id,
    type: 'place',
    updated: { date: updated, timezone: 'UTC', timezone_type: 3 },
    weight: 3
})

const now = dayjs().utc().format('YYYY-MM-DD HH:mm:ss')

describe('FeedList', () => {
    it('renders the stories in order', () => {
        render(<FeedList stories={[story('a', now), story('b', '2020-01-01 10:00:00')]} />)

        expect(screen.getAllByTestId('story').map((item) => item.textContent)).toStrictEqual(['a', 'b'])
        expect(screen.queryByRole('heading')).toBeNull()
    })

    it('puts the stories under day headings', () => {
        render(
            <FeedList
                stories={[story('a', now), story('b', '2020-01-01 10:00:00'), story('c', '2020-01-01 09:00:00')]}
                groupByDay={true}
            />
        )

        const headings = screen.getAllByRole('heading')
        expect(headings).toHaveLength(2)
        expect(headings[0]).toHaveTextContent('feed-today')
        expect(headings[1]).toHaveTextContent('2020')
    })

    it('passes the density and the place history mode to the stories', () => {
        render(
            <FeedList
                stories={[story('a', now)]}
                density={'compact'}
                hidePlace={true}
            />
        )

        expect(screen.getByTestId('story')).toHaveAttribute('data-density', 'compact')
        expect(screen.getByTestId('story')).toHaveAttribute('data-hide-place', 'true')
    })

    it('shows one line when there is nothing', () => {
        render(<FeedList stories={[]} />)
        expect(screen.getByText('Тут пока ничего нет')).toBeInTheDocument()
    })

    it('shows the given empty text', () => {
        render(
            <FeedList
                stories={[]}
                emptyText={'Nothing yet'}
            />
        )
        expect(screen.getByText('Nothing yet')).toBeInTheDocument()
    })

    it('shows skeletons instead of the empty line while loading', () => {
        render(<FeedList loading={true} />)

        expect(screen.getAllByTestId('loader').length).toBeGreaterThan(0)
        expect(screen.queryByText('Тут пока ничего нет')).toBeNull()
    })

    it('renders the footer under the list', () => {
        render(
            <FeedList
                stories={[story('a', now)]}
                footer={<button type={'button'}>{'more'}</button>}
            />
        )
        expect(screen.getByRole('button', { name: 'more' })).toBeInTheDocument()
    })
})
