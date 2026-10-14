import React from 'react'

import { render } from '@testing-library/react'

import { useInfiniteScroll } from './useInfiniteScroll'

type Callback = (entries: Array<{ isIntersecting: boolean }>) => void

const observers: Array<{ callback: Callback; disconnect: jest.Mock; observe: jest.Mock }> = []

beforeEach(() => {
    observers.length = 0
    window.IntersectionObserver = jest.fn((callback: Callback) => {
        const observer = { callback, disconnect: jest.fn(), observe: jest.fn() }
        observers.push(observer)
        return observer
    }) as unknown as typeof IntersectionObserver
})

const Feed: React.FC<{ hasMore?: boolean; loading?: boolean; failed?: boolean; onLoadMore: () => void }> = (props) => {
    const sentinelRef = useInfiniteScroll(props)
    return <div ref={sentinelRef} />
}

describe('useInfiniteScroll', () => {
    it('loads more when the sentinel comes into view', () => {
        const onLoadMore = jest.fn()
        render(
            <Feed
                hasMore={true}
                onLoadMore={onLoadMore}
            />
        )

        observers[0].callback([{ isIntersecting: true }])

        expect(onLoadMore).toHaveBeenCalledTimes(1)
    })

    it('does nothing while the sentinel is out of view', () => {
        const onLoadMore = jest.fn()
        render(
            <Feed
                hasMore={true}
                onLoadMore={onLoadMore}
            />
        )

        observers[0].callback([{ isIntersecting: false }])

        expect(onLoadMore).not.toHaveBeenCalled()
    })

    it('does not watch without a next page or while loading', () => {
        const { rerender } = render(<Feed onLoadMore={jest.fn()} />)
        expect(observers).toHaveLength(0)

        rerender(
            <Feed
                hasMore={true}
                loading={true}
                onLoadMore={jest.fn()}
            />
        )
        expect(observers).toHaveLength(0)
    })

    it('stops watching when the loading starts', () => {
        const { rerender } = render(
            <Feed
                hasMore={true}
                onLoadMore={jest.fn()}
            />
        )

        rerender(
            <Feed
                hasMore={true}
                loading={true}
                onLoadMore={jest.fn()}
            />
        )

        expect(observers[0].disconnect).toHaveBeenCalled()
    })

    it('does not retry by itself after a failed page', () => {
        render(
            <Feed
                hasMore={true}
                failed={true}
                onLoadMore={jest.fn()}
            />
        )

        expect(observers).toHaveLength(0)
    })
})
